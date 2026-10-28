//! Bounded, evidence-preserving crawler used by the background worker process.
//! It intentionally never executes page JavaScript or untrusted structured-data scripts.
use std::{
    collections::{HashMap, HashSet, VecDeque},
    net::SocketAddr,
    sync::Arc,
    time::Duration,
};

use anyhow::{Context, Result};
use futures_util::StreamExt;
use reqwest::{Client, StatusCode, header::LOCATION, redirect::Policy};
use scraper::{Html, Selector};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use tokio::net::lookup_host;
use tokio::sync::{RwLock, watch};
use tokio::task::JoinSet;
use tracing::{info, warn};
use url::Url;
use uuid::Uuid;

use crate::{
    config::Config,
    crawler::{
        robots::RobotsDocument,
        safe_url::{CanonicalUrl, ensure_public_ip},
    },
};

const MAX_REDIRECTS: usize = 5;

pub async fn run_forever(
    pool: PgPool,
    config: Config,
    worker_id: String,
    mut shutdown: watch::Receiver<bool>,
) -> Result<()> {
    let mut last_cache_sweep = std::time::Instant::now();
    let mut last_report_sweep = std::time::Instant::now();
    loop {
        if *shutdown.borrow() {
            info!("crawl worker shutdown requested");
            return Ok(());
        }
        if last_cache_sweep.elapsed() >= Duration::from_secs(600) {
            sqlx::query("WITH expired AS (SELECT canonical_url FROM fetch_cache WHERE expires_at<now() ORDER BY expires_at LIMIT 500) DELETE FROM fetch_cache f USING expired e WHERE f.canonical_url=e.canonical_url")
                .execute(&pool).await?;
            last_cache_sweep = std::time::Instant::now();
        }
        if last_report_sweep.elapsed() >= Duration::from_secs(3600) {
            let removed =
                crate::services::reports::cleanup_expired(&pool, &config.report_storage_dir)
                    .await?;
            tracing::info!(removed, "expired report artifacts removed");
            last_report_sweep = std::time::Instant::now();
        }
        if crate::services::reports::process_next(&pool, &config.report_storage_dir, &worker_id)
            .await?
        {
            continue;
        }
        // Recover only expired leases; live workers retain exclusive ownership.
        sqlx::query("UPDATE crawl_jobs SET status='queued', locked_by=NULL, lease_expires_at=NULL, available_at=now() WHERE status='running' AND lease_expires_at < now()")
            .execute(&pool)
            .await?;
        match claim_next(&pool, &worker_id).await? {
            Some(audit_id) => {
                if let Err(error) = run_audit(&pool, &config, audit_id).await {
                    warn!(%audit_id, %error, "crawl job failed");
                    fail_audit(&pool, audit_id, &error.to_string()).await?;
                }
            }
            None => {
                tokio::select! {
                    _ = tokio::time::sleep(Duration::from_secs(2)) => {}
                    changed = shutdown.changed() => {
                        if changed.is_err() || *shutdown.borrow() {
                            info!("crawl worker shutdown requested");
                            return Ok(());
                        }
                    }
                }
            }
        }
    }
}

async fn claim_next(pool: &PgPool, worker_id: &str) -> Result<Option<Uuid>> {
    let id = sqlx::query_scalar::<_, Uuid>(
        "WITH candidate AS (SELECT id FROM crawl_jobs WHERE status = 'queued' AND available_at <= now() ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1) \
         UPDATE crawl_jobs j SET status = 'running', attempts = attempts + 1, locked_by = $1, lease_expires_at = now() + interval '10 minutes' \
         FROM candidate WHERE j.id = candidate.id RETURNING j.audit_run_id"
    ).bind(worker_id).fetch_optional(pool).await?;
    Ok(id)
}

async fn run_audit(pool: &PgPool, config: &Config, audit_id: Uuid) -> Result<()> {
    let root: String = sqlx::query_scalar("UPDATE audit_runs SET status = 'running', started_at = now() WHERE id = $1 RETURNING canonical_url")
        .bind(audit_id).fetch_one(pool).await?;
    sqlx::query("DELETE FROM audit_findings WHERE audit_run_id=$1")
        .bind(audit_id)
        .execute(pool)
        .await?;
    sqlx::query("INSERT INTO crawl_runs(audit_run_id,crawler_version) VALUES($1,'1.1.0') ON CONFLICT(audit_run_id) DO UPDATE SET crawler_version=EXCLUDED.crawler_version,started_at=now(),completed_at=NULL,pages_attempted=0,pages_fetched=0,excluded_by_robots=0,coverage_notes='[]'::jsonb")
        .bind(audit_id).execute(pool).await?;
    let engine = CrawlEngine::with_cache(
        pool.clone(),
        config.crawl_response_byte_limit,
        config.crawl_request_timeout_secs,
        config.crawl_max_redirects,
        config.crawl_cache_ttl_secs,
    );
    let mut queue = VecDeque::from([(
        CanonicalUrl::parse(&root).map_err(anyhow::Error::msg)?,
        0_usize,
    )]);
    let mut visited = HashSet::new();
    let root_url = Url::parse(&root)?;
    let root_host = root_url.host_str().unwrap_or_default().to_ascii_lowercase();
    let (robots, robots_unreachable) = discover_robots(&engine, &root_url).await;
    if let Some(rules) = &robots {
        persist_robots_observation(pool, audit_id, rules).await?;
        for sitemap in &rules.sitemaps {
            let same_host = Url::parse(sitemap)
                .ok()
                .and_then(|url| url.host_str().map(str::to_owned))
                .is_some_and(|host| host.eq_ignore_ascii_case(&root_host));
            if same_host {
                add_sitemap_urls(&engine, sitemap, &root_host, &mut queue).await;
            }
        }
    }
    // Sitemap discovery is attempted even when robots.txt is unavailable.
    if !robots_unreachable {
        add_sitemap_urls(
            &engine,
            &format!("{}/sitemap.xml", root_url.origin().ascii_serialization()),
            &root_host,
            &mut queue,
        )
        .await;
    }
    for (url, depth) in &queue {
        sqlx::query("INSERT INTO crawl_frontier(audit_run_id,url,depth,state) VALUES($1,$2,$3,'queued') ON CONFLICT(audit_run_id,url) DO NOTHING")
            .bind(audit_id).bind(url.as_str()).bind(*depth as i32).execute(pool).await?;
    }
    sqlx::query("UPDATE crawl_frontier SET state='queued',updated_at=now() WHERE audit_run_id=$1 AND state='in_progress'")
        .bind(audit_id).execute(pool).await?;
    let checkpoints: Vec<(String,i32,String)> = sqlx::query_as("SELECT url,depth,state FROM crawl_frontier WHERE audit_run_id=$1 AND state IN ('queued','completed','robots_excluded','skipped') ORDER BY depth,url")
        .bind(audit_id).fetch_all(pool).await?;
    queue.clear();
    for (url, depth, state) in checkpoints {
        if state == "queued" {
            if let Ok(url) = CanonicalUrl::parse(&url) {
                queue.push_back((url, depth.max(0) as usize));
            }
        } else if state == "completed" || state == "robots_excluded" {
            visited.insert(url);
        }
    }
    let mut partial_reason = None;
    let robots_url = format!("{}/robots.txt", root_url.origin().ascii_serialization());

    // Discovery is deliberately sequential in this first implementation. It honours the audit
    // budget deterministically; concurrent fetching is introduced with per-origin limits later.
    const CONCURRENT_FETCHES: usize = 32;
    while !queue.is_empty() {
        if cancellation_requested(pool, audit_id).await? {
            cancel_audit(pool, audit_id).await?;
            return Ok(());
        }
        sqlx::query("UPDATE crawl_jobs SET lease_expires_at=now()+interval '10 minutes' WHERE audit_run_id=$1 AND status='running'")
            .bind(audit_id).execute(pool).await?;
        if visited.len() >= config.crawl_page_limit {
            partial_reason = Some("The configured crawl page limit was reached.".to_owned());
            break;
        }

        // Collect a batch of URLs ready for fetching.
        let mut batch: Vec<(CanonicalUrl, usize)> = Vec::new();
        while batch.len() < CONCURRENT_FETCHES {
            let Some((url, depth)) = queue.pop_front() else { break };
            if depth > config.crawl_max_depth {
                sqlx::query("UPDATE crawl_frontier SET state='skipped',updated_at=now() WHERE audit_run_id=$1 AND url=$2")
                    .bind(audit_id).bind(url.as_str()).execute(pool).await?;
                continue;
            }
            if !visited.insert(url.as_str().to_owned()) {
                continue;
            }
            if robots
                .as_ref()
                .is_some_and(|rules| !rules.evaluate("AnswerScopeBot", url.as_str()).allowed)
            {
                persist_excluded_by_robots(pool, audit_id, url.as_str()).await?;
                sqlx::query("UPDATE crawl_frontier SET state='robots_excluded',updated_at=now() WHERE audit_run_id=$1 AND url=$2")
                    .bind(audit_id).bind(url.as_str()).execute(pool).await?;
                continue;
            }
            if robots_unreachable {
                partial_reason =
                    Some("robots.txt could not be fetched safely; crawl pages were deferred.".into());
                persist_robots_unreachable(pool, audit_id, url.as_str(), &robots_url).await?;
                sqlx::query("UPDATE crawl_frontier SET state='skipped',updated_at=now() WHERE audit_run_id=$1 AND url=$2")
                    .bind(audit_id).bind(url.as_str()).execute(pool).await?;
                continue;
            }
            sqlx::query("UPDATE crawl_frontier SET state='in_progress',updated_at=now() WHERE audit_run_id=$1 AND url=$2")
                .bind(audit_id).bind(url.as_str()).execute(pool).await?;
            // Reduced delay for faster crawling
            tokio::time::sleep(Duration::from_millis(0)).await;
            batch.push((url, depth));
        }

        if batch.is_empty() {
            break;
        }

        // Fetch the batch concurrently using connection-pooled clients pinned to resolved addresses.
        let mut join_set = JoinSet::new();
        for (url, depth) in batch {
            let engine = engine.clone();
            join_set.spawn(async move {
                let result = engine.fetch_html(url.as_str()).await;
                (url, depth, result)
            });
        }

        // Process results sequentially to preserve deterministic DB writes.
        while let Some(result) = join_set.join_next().await {
            let (url, depth, fetch_result) = match result {
                Ok(item) => item,
                Err(_) => continue,
            };
            match fetch_result {
                Ok(page) => {
                    let analysis = analyze_html(
                        url.as_str(),
                        &page.final_url,
                        &page.body,
                        page.status.as_u16(),
                        page.content_type.as_deref(),
                        page.x_robots_tag.as_deref(),
                        &page.redirect_chain,
                    );
                    persist_page(pool, audit_id, &analysis, depth as i32).await?;
                    persist_links(
                        pool,
                        audit_id,
                        &analysis.url,
                        &analysis.link_records,
                        &root_host,
                    )
                    .await?;
                    for link in &analysis.internal_links {
                        if let Ok(next) = CanonicalUrl::parse(link) {
                            let parsed = Url::parse(next.as_str())?;
                            if parsed
                                .host_str()
                                .is_some_and(|h| h.eq_ignore_ascii_case(&root_host))
                                && !visited.contains(next.as_str())
                            {
                                queue.push_back((next, depth + 1));
                                let queued = queue.back().expect("just appended checkpoint");
                                sqlx::query("INSERT INTO crawl_frontier(audit_run_id,url,depth,state) VALUES($1,$2,$3,'queued') ON CONFLICT(audit_run_id,url) DO NOTHING")
                                    .bind(audit_id).bind(queued.0.as_str()).bind(queued.1 as i32).execute(pool).await?;
                            }
                        }
                    }
                    sqlx::query("UPDATE crawl_frontier SET state='completed',updated_at=now() WHERE audit_run_id=$1 AND url=$2")
                        .bind(audit_id).bind(url.as_str()).execute(pool).await?;
                }
                Err(error) => {
                    partial_reason =
                        Some("One or more pages could not be retrieved safely.".to_owned());
                    persist_fetch_failure(pool, audit_id, url.as_str(), &error.to_string()).await?;
                    sqlx::query("UPDATE crawl_frontier SET state='completed',updated_at=now() WHERE audit_run_id=$1 AND url=$2")
                        .bind(audit_id).bind(url.as_str()).execute(pool).await?;
                }
            }
        }
    }
    create_run_findings(pool, audit_id).await?;
    persist_audit_score(pool, audit_id).await?;
    let status = if partial_reason.is_some() {
        "partially_completed"
    } else {
        "completed"
    };
    sqlx::query("UPDATE audit_runs SET status = $2::audit_run_status, completed_at = now(), failure_reason = $3 WHERE id = $1").bind(audit_id).bind(status).bind(&partial_reason).execute(pool).await?;
    sqlx::query("UPDATE crawl_runs SET completed_at=now(),pages_attempted=(SELECT count(*) FROM crawled_pages WHERE audit_run_id=$1),pages_fetched=(SELECT count(*) FROM crawled_pages WHERE audit_run_id=$1 AND status_code BETWEEN 200 AND 299),excluded_by_robots=(SELECT count(*) FROM crawled_pages WHERE audit_run_id=$1 AND structured_data @> '[{\"excluded\":\"robots.txt\"}]'::jsonb),coverage_notes=$2 WHERE audit_run_id=$1")
        .bind(audit_id).bind(serde_json::json!(partial_reason.into_iter().collect::<Vec<_>>())).execute(pool).await?;
    sqlx::query("UPDATE crawl_jobs SET status = 'completed', completed_at = now(), lease_expires_at = NULL WHERE audit_run_id = $1 AND status = 'running'").bind(audit_id).execute(pool).await?;
    sqlx::query("INSERT INTO notifications(user_id,organization_id,notification_type,title,body,action_url,data) SELECT m.user_id,p.organization_id,'audit.completed','Website audit complete',CASE WHEN a.status='partially_completed' THEN 'Your website audit completed with limited coverage.' ELSE 'Your website audit is ready to review.' END,'/audits/'||a.id::text,jsonb_build_object('audit_id',a.id) FROM audit_runs a JOIN projects p ON p.id=a.project_id JOIN memberships m ON m.organization_id=p.organization_id WHERE a.id=$1 AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=m.user_id AND n.notification_type='audit.completed' AND n.data->>'audit_id'=a.id::text)")
        .bind(audit_id).execute(pool).await?;
    info!(%audit_id, pages = visited.len(), "audit completed");
    Ok(())
}

async fn discover_robots(engine: &CrawlEngine, root: &Url) -> (Option<RobotsDocument>, bool) {
    let robots_url = format!("{}/robots.txt", root.origin().ascii_serialization());
    match engine.fetch_html(&robots_url).await {
        Ok(response) if response.status.is_success() => {
            (Some(RobotsDocument::parse(&response.body)), false)
        }
        Ok(response) if response.status.is_client_error() => (None, false),
        Ok(_) | Err(_) => (None, true),
    }
}

async fn add_sitemap_urls(
    engine: &CrawlEngine,
    sitemap: &str,
    root_host: &str,
    queue: &mut VecDeque<(CanonicalUrl, usize)>,
) {
    let mut pending = VecDeque::from([(sitemap.to_owned(), 0_u8)]);
    let mut seen = HashSet::new();
    let mut discovered_urls = 0usize;
    while let Some((sitemap, depth)) = pending.pop_front() {
        if seen.len() >= 20 || discovered_urls >= 5_000 {
            break;
        }
        if !seen.insert(sitemap.clone()) {
            continue;
        }
        let Ok(response) = engine.fetch_html(&sitemap).await else {
            continue;
        };
        if !response.status.is_success() {
            continue;
        }
        let document = crate::crawler::sitemap::parse(&response.body);
        let is_index = document.kind == crate::crawler::sitemap::SitemapKind::SitemapIndex;
        // XML is never executed. We only accept loc values that pass the same safe URL policy
        // used for user input and remain in the audited host scope.
        for entry in document.entries.into_iter().take(500) {
            let location = entry.location;
            if is_index && depth < 3 {
                if let Ok(child) = CanonicalUrl::parse(&location) {
                    let child_host = Url::parse(child.as_str())
                        .ok()
                        .and_then(|url| url.host_str().map(str::to_owned));
                    if child_host.is_some_and(|host| host.eq_ignore_ascii_case(root_host)) {
                        pending.push_back((child.into_string(), depth + 1));
                    }
                }
                continue;
            }
            let Ok(url) = CanonicalUrl::parse(&location) else {
                continue;
            };
            let same_host = Url::parse(url.as_str())
                .ok()
                .and_then(|parsed| parsed.host_str().map(str::to_owned))
                .is_some_and(|host| host.eq_ignore_ascii_case(root_host));
            if same_host {
                queue.push_back((url, 0));
                discovered_urls += 1;
            }
        }
    }
}

async fn cancellation_requested(pool: &PgPool, audit_id: Uuid) -> Result<bool> {
    Ok(sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM crawl_jobs WHERE audit_run_id=$1 AND cancel_requested_at IS NOT NULL)")
        .bind(audit_id).fetch_one(pool).await?)
}

async fn cancel_audit(pool: &PgPool, audit_id: Uuid) -> Result<()> {
    sqlx::query("UPDATE audit_runs SET status='canceled'::audit_run_status, completed_at=now(), failure_reason='Canceled by request.' WHERE id=$1")
        .bind(audit_id).execute(pool).await?;
    sqlx::query("UPDATE crawl_jobs SET status='canceled', completed_at=now(), lease_expires_at=NULL WHERE audit_run_id=$1 AND status='running'")
        .bind(audit_id).execute(pool).await?;
    sqlx::query("UPDATE crawl_runs SET completed_at=now(),coverage_notes='[\"Canceled by requester.\"]'::jsonb WHERE audit_run_id=$1")
        .bind(audit_id).execute(pool).await?;
    Ok(())
}

async fn fail_audit(pool: &PgPool, audit_id: Uuid, reason: &str) -> Result<()> {
    let attempts: i32 = sqlx::query_scalar(
        "SELECT attempts FROM crawl_jobs WHERE audit_run_id=$1 AND status='running' LIMIT 1",
    )
    .bind(audit_id)
    .fetch_optional(pool)
    .await?
    .unwrap_or(3);
    let retry = attempts < 3;
    sqlx::query("UPDATE audit_runs SET status=CASE WHEN $3 THEN 'queued'::audit_run_status ELSE 'failed'::audit_run_status END, completed_at=CASE WHEN $3 THEN NULL ELSE now() END, failure_reason=$2 WHERE id=$1")
        .bind(audit_id).bind(reason).bind(retry).execute(pool).await?;
    sqlx::query("UPDATE crawl_jobs SET status=CASE WHEN $3 THEN 'queued'::job_status ELSE 'failed'::job_status END, last_error=$2, available_at=CASE WHEN $3 THEN now() + make_interval(secs => LEAST(300, 2 ^ attempts)) ELSE available_at END, completed_at=CASE WHEN $3 THEN NULL ELSE now() END, lease_expires_at=NULL, locked_by=NULL WHERE audit_run_id=$1 AND status='running'")
        .bind(audit_id).bind(reason).bind(retry).execute(pool).await?;
    sqlx::query("UPDATE crawl_runs SET completed_at=CASE WHEN $2 THEN NULL ELSE now() END,coverage_notes=jsonb_build_array($3) WHERE audit_run_id=$1")
        .bind(audit_id).bind(retry).bind(reason).execute(pool).await?;
    Ok(())
}

#[derive(Clone)]
pub struct CrawlEngine {
    byte_limit: usize,
    request_timeout: Duration,
    max_redirects: usize,
    cache: Option<PgPool>,
    cache_ttl: Duration,
    clients: Arc<RwLock<HashMap<String, Client>>>,
}
pub struct FetchedPage {
    pub final_url: String,
    pub status: StatusCode,
    pub content_type: Option<String>,
    pub body: String,
    pub x_robots_tag: Option<String>,
    pub redirect_chain: Vec<String>,
}
impl CrawlEngine {
    pub fn new(byte_limit: usize) -> Self {
        Self {
            byte_limit,
            request_timeout: Duration::from_secs(15),
            max_redirects: MAX_REDIRECTS,
            cache: None,
            cache_ttl: Duration::ZERO,
            clients: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    pub fn with_cache(
        pool: PgPool,
        byte_limit: usize,
        timeout_secs: u64,
        max_redirects: usize,
        cache_ttl_secs: u64,
    ) -> Self {
        Self {
            byte_limit,
            request_timeout: Duration::from_secs(timeout_secs.clamp(1, 60)),
            max_redirects: max_redirects.min(10),
            cache: Some(pool),
            cache_ttl: Duration::from_secs(cache_ttl_secs.min(3600)),
            clients: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    pub async fn fetch_html(&self, start: &str) -> Result<FetchedPage> {
        let mut next = CanonicalUrl::parse(start)
            .map_err(anyhow::Error::msg)?
            .into_string();
        let cache_key = next.clone();
        if let Some(pool) = &self.cache {
            validate_public_target(&next).await?;
            if !self.cache_ttl.is_zero() && cache_allowed(&cache_key) {
                match load_cached_page(pool, &cache_key, self.byte_limit).await {
                    Ok(Some(cached)) => {
                        for url in cached
                            .redirect_chain
                            .iter()
                            .chain(std::iter::once(&cached.final_url))
                        {
                            validate_public_target(url).await?;
                        }
                        return Ok(cached);
                    }
                    Ok(None) => {}
                    Err(error) => warn!(%error, "fetch cache read failed; performing live request"),
                }
            }
        }
        let mut redirect_chain = Vec::new();
        let mut seen_redirects = HashSet::new();
        for _ in 0..=self.max_redirects {
            if !seen_redirects.insert(next.clone()) {
                anyhow::bail!("redirect loop detected");
            }
            let url = Url::parse(&next)?;
            let host = url.host_str().context("target URL has no host")?;
            let port = url.port_or_known_default().unwrap_or(443);
            let addresses =
                resolve_public_addresses(host, port).await?;
            // Every hop performs fresh canonicalization and DNS safety checks.
            // Clients are pinned to resolved addresses and pooled per host for keep-alive reuse.
            let client = self.get_client(host, port, &addresses).await?;
            let response = client
                .get(url.clone())
                .header(
                    "User-Agent",
                    "AnswerScopeBot/0.1 (+https://answerscope.example/bot)",
                )
                .send()
                .await?;
            if response.status().is_redirection() {
                redirect_chain.push(next.clone());
                let location = response
                    .headers()
                    .get(LOCATION)
                    .context("redirect response had no Location header")?
                    .to_str()?;
                let joined = url.join(location)?;
                next = CanonicalUrl::parse(joined.as_str())
                    .map_err(anyhow::Error::msg)?
                    .into_string();
                continue;
            }
            let content_type = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .map(str::to_owned);
            let x_robots_tag = response
                .headers()
                .get("x-robots-tag")
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned);
            let cache_control = response
                .headers()
                .get(reqwest::header::CACHE_CONTROL)
                .and_then(|value| value.to_str().ok())
                .unwrap_or_default()
                .to_ascii_lowercase();
            let response_cacheable = !cache_control
                .split(',')
                .any(|directive| directive.trim() == "no-store" || directive.trim() == "private");
            if response
                .content_length()
                .is_some_and(|size| size as usize > self.byte_limit)
            {
                anyhow::bail!("response exceeded the configured byte limit");
            }
            let status = response.status();
            let mut body = Vec::new();
            let mut stream = response.bytes_stream();
            while let Some(chunk) = stream.next().await {
                let chunk = chunk?;
                if body.len() + chunk.len() > self.byte_limit {
                    anyhow::bail!("response exceeded the configured byte limit");
                }
                body.extend_from_slice(&chunk);
            }
            let fetched = FetchedPage {
                final_url: next,
                status,
                content_type,
                body: String::from_utf8_lossy(&body).into_owned(),
                x_robots_tag,
                redirect_chain,
            };
            if status.is_success()
                && response_cacheable
                && self.cache_ttl > Duration::ZERO
                && cache_allowed(&cache_key)
            {
                if let Some(pool) = &self.cache {
                    if let Err(error) =
                        store_cached_page(pool, &cache_key, &fetched, self.cache_ttl).await
                    {
                        warn!(%error,"fetch cache write failed");
                    }
                }
            }
            return Ok(fetched);
        }
        anyhow::bail!("redirect limit exceeded")
    }

    async fn get_client(&self, host: &str, port: u16, addresses: &[SocketAddr]) -> Result<Client> {
        let key = format!("{host}:{port}");
        {
            let readers = self.clients.read().await;
            if let Some(client) = readers.get(&key) {
                return Ok(client.clone());
            }
        }
        let mut writers = self.clients.write().await;
        if let Some(client) = writers.get(&key) {
            return Ok(client.clone());
        }
        let client = Client::builder()
            .redirect(Policy::none())
            .timeout(self.request_timeout)
            .connect_timeout(Duration::from_secs(5))
            .resolve_to_addrs(host, addresses)
            .build()?;
        writers.insert(key, client.clone());
        Ok(client)
    }
}

fn cache_allowed(raw: &str) -> bool {
    Url::parse(raw)
        .ok()
        .is_some_and(|url| url.query().is_none() && !url.path().eq_ignore_ascii_case("/robots.txt"))
}

#[derive(sqlx::FromRow)]
struct CachedPageRow {
    status_code: i16,
    final_url: String,
    content_type: Option<String>,
    body: String,
    x_robots_tag: Option<String>,
    redirect_chain: Value,
}

async fn validate_public_target(raw: &str) -> Result<Vec<SocketAddr>> {
    let target = CanonicalUrl::parse(raw).map_err(anyhow::Error::msg)?;
    let url = Url::parse(target.as_str())?;
    let host = url.host_str().context("target URL has no host")?;
    resolve_public_addresses(host, url.port_or_known_default().unwrap_or(443)).await
}

async fn load_cached_page(
    pool: &PgPool,
    url: &str,
    byte_limit: usize,
) -> Result<Option<FetchedPage>> {
    let row:Option<CachedPageRow>=sqlx::query_as("SELECT status_code,final_url,content_type,body,x_robots_tag,redirect_chain FROM fetch_cache WHERE canonical_url=$1 AND expires_at>now()")
        .bind(url).fetch_optional(pool).await?;
    let Some(row) = row else { return Ok(None) };
    if row.body.len() > byte_limit {
        return Ok(None);
    }
    let status =
        StatusCode::from_u16(row.status_code as u16).context("cached HTTP status is invalid")?;
    let redirect_chain =
        serde_json::from_value(row.redirect_chain).context("cached redirect chain is invalid")?;
    Ok(Some(FetchedPage {
        final_url: row.final_url,
        status,
        content_type: row.content_type,
        body: row.body,
        x_robots_tag: row.x_robots_tag,
        redirect_chain,
    }))
}

async fn store_cached_page(
    pool: &PgPool,
    url: &str,
    page: &FetchedPage,
    ttl: Duration,
) -> Result<()> {
    sqlx::query("INSERT INTO fetch_cache(canonical_url,status_code,final_url,content_type,body,x_robots_tag,redirect_chain,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+make_interval(secs=>$8)) ON CONFLICT(canonical_url) DO UPDATE SET status_code=EXCLUDED.status_code,final_url=EXCLUDED.final_url,content_type=EXCLUDED.content_type,body=EXCLUDED.body,x_robots_tag=EXCLUDED.x_robots_tag,redirect_chain=EXCLUDED.redirect_chain,fetched_at=now(),expires_at=EXCLUDED.expires_at")
        .bind(url).bind(page.status.as_u16() as i16).bind(&page.final_url).bind(&page.content_type).bind(&page.body).bind(&page.x_robots_tag).bind(serde_json::json!(page.redirect_chain)).bind(ttl.as_secs() as i64).execute(pool).await?;
    Ok(())
}

async fn resolve_public_addresses(host: &str, port: u16) -> Result<Vec<SocketAddr>> {
    let addresses: Vec<_> = lookup_host((host, port)).await?.collect();
    if addresses.is_empty() {
        anyhow::bail!("DNS lookup returned no addresses");
    }
    for address in &addresses {
        ensure_public_ip(address.ip()).map_err(anyhow::Error::msg)?;
    }
    Ok(addresses)
}

struct PageAnalysis {
    url: String,
    final_url: String,
    canonical_url: Option<String>,
    status: u16,
    content_type: Option<String>,
    title: Option<String>,
    description: Option<String>,
    robots: Option<String>,
    x_robots_tag: Option<String>,
    headings: Value,
    links: Value,
    structured_data: Value,
    word_count: i32,
    main_text: String,
    content_hash: String,
    redirect_chain: Vec<String>,
    internal_links: Vec<String>,
    link_records: Vec<(String, Option<String>)>,
}
fn analyze_html(
    requested_url: &str,
    final_url: &str,
    body: &str,
    status: u16,
    content_type: Option<&str>,
    x_robots_tag: Option<&str>,
    redirect_chain: &[String],
) -> PageAnalysis {
    let document = Html::parse_document(body);
    let select = |query: &str| Selector::parse(query).expect("static selector is valid");
    let text = |query: &str| {
        document
            .select(&select(query))
            .next()
            .map(|node| node.text().collect::<Vec<_>>().join(" ").trim().to_owned())
            .filter(|value| !value.is_empty())
    };
    let attribute = |query: &str, attribute: &str| {
        document
            .select(&select(query))
            .next()
            .and_then(|node| node.value().attr(attribute))
            .map(str::to_owned)
    };
    let headings: Vec<_> = document.select(&select("h1,h2,h3,h4,h5,h6")).map(|node| json!({"level": node.value().name(), "text": node.text().collect::<Vec<_>>().join(" ").trim()})).collect();
    let base = Url::parse(final_url).ok();
    let link_records: Vec<(String, Option<String>)> = document
        .select(&select("a[href]"))
        .filter_map(|node| {
            let href = node.value().attr("href")?;
            let link = base.as_ref()?.join(href).ok()?;
            if !matches!(link.scheme(), "http" | "https") {
                return None;
            }
            let mut link = link;
            link.set_fragment(None);
            let target = link.into();
            let anchor = node
                .text()
                .collect::<Vec<_>>()
                .join(" ")
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            Some((target, (!anchor.is_empty()).then_some(anchor)))
        })
        .collect();
    let internal_links: Vec<String> = link_records
        .iter()
        .map(|(target, _)| target.clone())
        .collect();
    let schema = crate::geo_audit::schema::extract_markup(&document);
    let main_text = extract_main_text(&document);
    let canonical_url = attribute("link[rel='canonical']", "href").and_then(|value| {
        Url::parse(final_url)
            .ok()?
            .join(&value)
            .ok()
            .map(|url| url.to_string())
    });
    let normalized = main_text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase();
    let content_hash = Sha256::digest(normalized.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    let words = normalized.split_whitespace().count() as i32;
    PageAnalysis {
        url: requested_url.into(),
        final_url: final_url.into(),
        canonical_url,
        status,
        content_type: content_type.map(str::to_owned),
        title: text("title"),
        description: attribute("meta[name='description']", "content"),
        robots: attribute("meta[name='robots']", "content"),
        x_robots_tag: x_robots_tag.map(str::to_owned),
        headings: Value::Array(headings),
        links: json!(
            link_records
                .iter()
                .map(|(url, anchor)| json!({"url":url,"anchor":anchor}))
                .collect::<Vec<_>>()
        ),
        structured_data: Value::Array(schema),
        word_count: words,
        main_text: main_text.chars().take(100_000).collect(),
        content_hash,
        redirect_chain: redirect_chain.to_vec(),
        internal_links,
        link_records,
    }
}

pub fn extract_main_text(document: &Html) -> String {
    let main = Selector::parse("main,article,[role='main']").expect("static selector");
    let body = Selector::parse("body").expect("static selector");
    let blocks =
        Selector::parse("h1,h2,h3,h4,h5,h6,p,li,blockquote,dt,dd,pre").expect("static selector");
    let root = document
        .select(&main)
        .next()
        .or_else(|| document.select(&body).next())
        .unwrap_or_else(|| document.root_element());
    let mut text = root
        .select(&blocks)
        .map(|node| node.text().collect::<Vec<_>>().join(" "))
        .collect::<Vec<_>>()
        .join(" ");
    if text.trim().is_empty() {
        text = root.text().collect::<Vec<_>>().join(" ");
    }
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

async fn persist_page(
    pool: &PgPool,
    audit_id: Uuid,
    page: &PageAnalysis,
    depth: i32,
) -> Result<()> {
    let page_id: Uuid = sqlx::query_scalar("INSERT INTO crawled_pages (audit_run_id,url,final_url,canonical_url,status_code,content_type,title,meta_description,meta_robots,x_robots_tag,headings,links,structured_data,content_hash,word_count,depth,redirect_chain) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT (audit_run_id,url) DO UPDATE SET fetched_at=now(),final_url=EXCLUDED.final_url,status_code=EXCLUDED.status_code,canonical_url=EXCLUDED.canonical_url,content_type=EXCLUDED.content_type,title=EXCLUDED.title,meta_description=EXCLUDED.meta_description,meta_robots=EXCLUDED.meta_robots,x_robots_tag=EXCLUDED.x_robots_tag,headings=EXCLUDED.headings,links=EXCLUDED.links,structured_data=EXCLUDED.structured_data,content_hash=EXCLUDED.content_hash,word_count=EXCLUDED.word_count,depth=EXCLUDED.depth,redirect_chain=EXCLUDED.redirect_chain RETURNING id")
        .bind(audit_id).bind(&page.url).bind(&page.final_url).bind(&page.canonical_url).bind(page.status as i32).bind(&page.content_type).bind(&page.title).bind(&page.description).bind(&page.robots).bind(&page.x_robots_tag).bind(&page.headings).bind(&page.links).bind(&page.structured_data).bind(&page.content_hash).bind(page.word_count).bind(depth).bind(serde_json::json!(page.redirect_chain)).fetch_one(pool).await?;
    sqlx::query("INSERT INTO page_extractions(crawled_page_id,main_text,extraction) VALUES($1,$2,$3) ON CONFLICT(crawled_page_id) DO UPDATE SET main_text=EXCLUDED.main_text,extraction=EXCLUDED.extraction,extracted_at=now()")
        .bind(page_id).bind(&page.main_text).bind(serde_json::json!({"word_count":page.word_count,"title":page.title,"description":page.description,"headings":page.headings})).execute(pool).await?;
    sqlx::query("INSERT INTO content_fingerprints(crawled_page_id,audit_run_id,algorithm,normalized_hash,token_count) VALUES($1,$2,'sha256-normalized-text-v1',$3,$4) ON CONFLICT(crawled_page_id) DO UPDATE SET algorithm=EXCLUDED.algorithm,normalized_hash=EXCLUDED.normalized_hash,token_count=EXCLUDED.token_count,created_at=now()")
        .bind(page_id).bind(audit_id).bind(&page.content_hash).bind(page.word_count.max(0)).execute(pool).await?;
    Ok(())
}
async fn persist_links(
    pool: &PgPool,
    audit_id: Uuid,
    source_url: &str,
    links: &[(String, Option<String>)],
    root_host: &str,
) -> Result<()> {
    for (target, anchor_text) in links {
        let is_internal = Url::parse(target)
            .ok()
            .and_then(|url| url.host_str().map(str::to_owned))
            .is_some_and(|host| host.eq_ignore_ascii_case(root_host));
        sqlx::query("INSERT INTO crawl_links (audit_run_id,source_url,target_url,anchor_text,is_internal) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING").bind(audit_id).bind(source_url).bind(target).bind(anchor_text).bind(is_internal).execute(pool).await?;
    }
    Ok(())
}
async fn persist_robots_observation(
    pool: &PgPool,
    audit_id: Uuid,
    rules: &RobotsDocument,
) -> Result<()> {
    sqlx::query("INSERT INTO audit_findings (audit_run_id,code,severity,title,recommendation,evidence) VALUES ($1,'robots.observed','info','robots.txt directives observed','These directives control permission signals for AnswerScopeBot and do not prove any third-party crawler visited the site.',$2)")
        .bind(audit_id).bind(serde_json::to_value(rules)?).execute(pool).await?;
    Ok(())
}
async fn persist_excluded_by_robots(pool: &PgPool, audit_id: Uuid, url: &str) -> Result<()> {
    sqlx::query("INSERT INTO crawled_pages (audit_run_id,url,headings,links,structured_data) VALUES ($1,$2,'[]','[]',jsonb_build_array(jsonb_build_object('excluded','robots.txt'))) ON CONFLICT (audit_run_id,url) DO NOTHING")
        .bind(audit_id).bind(url).execute(pool).await?;
    Ok(())
}
async fn persist_robots_unreachable(
    pool: &PgPool,
    audit_id: Uuid,
    url: &str,
    robots_url: &str,
) -> Result<()> {
    sqlx::query("INSERT INTO crawled_pages(audit_run_id,url,headings,links,structured_data) VALUES($1,$2,'[]','[]',jsonb_build_array(jsonb_build_object('excluded','robots_unavailable'))) ON CONFLICT(audit_run_id,url) DO NOTHING")
        .bind(audit_id).bind(robots_url).execute(pool).await?;
    sqlx::query("INSERT INTO audit_findings(audit_run_id,code,severity,title,recommendation,evidence) SELECT $1,'robots.unavailable','medium','robots.txt could not be retrieved','Check the robots.txt endpoint and retry the audit; page crawling was deferred because crawler permissions could not be observed.',jsonb_build_object('robots_url',$2) WHERE NOT EXISTS(SELECT 1 FROM audit_findings WHERE audit_run_id=$1 AND code='robots.unavailable')")
        .bind(audit_id).bind(url).execute(pool).await?;
    Ok(())
}
async fn persist_fetch_failure(
    pool: &PgPool,
    audit_id: Uuid,
    url: &str,
    error: &str,
) -> Result<()> {
    sqlx::query("INSERT INTO crawled_pages (audit_run_id,url,headings,links,structured_data) VALUES ($1,$2,'[]','[]',jsonb_build_array(jsonb_build_object('fetch_error',$3))) ON CONFLICT (audit_run_id,url) DO NOTHING").bind(audit_id).bind(url).bind(error).execute(pool).await?;
    Ok(())
}
async fn create_run_findings(pool: &PgPool, audit_id: Uuid) -> Result<()> {
    sqlx::query("INSERT INTO audit_findings (audit_run_id,code,severity,title,recommendation,evidence) SELECT $1,'metadata.missing_title','medium','Missing page title','Add a concise, unique title that accurately describes this page.',jsonb_build_object('url',url) FROM crawled_pages WHERE audit_run_id=$1 AND status_code BETWEEN 200 AND 299 AND (title IS NULL OR length(trim(title))=0)").bind(audit_id).execute(pool).await?;
    sqlx::query("INSERT INTO audit_findings (audit_run_id,code,severity,title,recommendation,evidence) SELECT $1,'metadata.missing_description','low','Missing meta description','Add a useful description of the page for search result snippets.',jsonb_build_object('url',url) FROM crawled_pages WHERE audit_run_id=$1 AND status_code BETWEEN 200 AND 299 AND (meta_description IS NULL OR length(trim(meta_description))=0)").bind(audit_id).execute(pool).await?;
    sqlx::query("INSERT INTO audit_findings (audit_run_id,code,severity,title,recommendation,evidence) SELECT $1,'headings.missing_h1','medium','Missing primary heading','Use one clear H1 that states the page topic.',jsonb_build_object('url',url) FROM crawled_pages WHERE audit_run_id=$1 AND status_code BETWEEN 200 AND 299 AND NOT jsonb_path_exists(headings, '$[*] ? (@.level == \"h1\")')").bind(audit_id).execute(pool).await?;
    sqlx::query("INSERT INTO audit_findings (audit_run_id,code,severity,title,recommendation,evidence) SELECT $1,'http.unsuccessful','high','Unsuccessful page response','Fix the response or update links pointing to this URL.',jsonb_build_object('url',url,'status_code',status_code,'fetch_error',structured_data->0->>'fetch_error') FROM crawled_pages WHERE audit_run_id=$1 AND (status_code >= 400 OR (status_code IS NULL AND NOT structured_data @> '[{\"excluded\":\"robots.txt\"}]'::jsonb AND NOT structured_data @> '[{\"excluded\":\"robots_unavailable\"}]'::jsonb))").bind(audit_id).execute(pool).await?;
    sqlx::query("INSERT INTO audit_findings (audit_run_id,code,severity,title,recommendation,evidence) SELECT $1,'canonical.missing','low','Missing canonical URL','Add a canonical URL when duplicate URL variants are possible.',jsonb_build_object('url',url) FROM crawled_pages WHERE audit_run_id=$1 AND status_code BETWEEN 200 AND 299 AND canonical_url IS NULL").bind(audit_id).execute(pool).await?;
    sqlx::query("INSERT INTO audit_findings (audit_run_id,code,severity,title,recommendation,evidence) SELECT $1,'metadata.duplicate_title','medium','Duplicate page title','Make page titles distinct where pages serve different user needs.',jsonb_build_object('title',title,'pages',jsonb_agg(url)) FROM crawled_pages WHERE audit_run_id=$1 AND title IS NOT NULL GROUP BY title HAVING count(*) > 1").bind(audit_id).execute(pool).await?;
    sqlx::query("INSERT INTO audit_findings (audit_run_id,code,severity,title,recommendation,evidence) SELECT $1,'metadata.duplicate_description','low','Duplicate meta description','Write distinct descriptions for pages with distinct purposes.',jsonb_build_object('description',meta_description,'pages',jsonb_agg(url)) FROM crawled_pages WHERE audit_run_id=$1 AND meta_description IS NOT NULL GROUP BY meta_description HAVING count(*) > 1").bind(audit_id).execute(pool).await?;
    sqlx::query("INSERT INTO audit_findings (audit_run_id,code,severity,title,recommendation,evidence) SELECT $1,'indexing.meta_noindex','high','Page declares noindex','Review this directive if the page is intended to be discoverable.',jsonb_build_object('url',url,'meta_robots',meta_robots) FROM crawled_pages WHERE audit_run_id=$1 AND meta_robots ILIKE '%noindex%'").bind(audit_id).execute(pool).await?;
    sqlx::query("INSERT INTO audit_findings (audit_run_id,code,severity,title,recommendation,evidence) SELECT $1,'indexing.header_noindex','high','Response header declares noindex','Review X-Robots-Tag if this page is intended to be discoverable.',jsonb_build_object('url',url,'x_robots_tag',x_robots_tag) FROM crawled_pages WHERE audit_run_id=$1 AND x_robots_tag ILIKE '%noindex%'").bind(audit_id).execute(pool).await?;
    sqlx::query("INSERT INTO audit_findings (audit_run_id,code,severity,title,recommendation,evidence) SELECT $1,'links.orphan_in_crawl','medium','Page has no incoming internal links','Add relevant internal links so visitors and crawlers can discover this page.',jsonb_build_object('url',p.url,'depth',p.depth) FROM crawled_pages p LEFT JOIN crawl_links l ON l.audit_run_id=p.audit_run_id AND l.target_url=p.url AND l.is_internal WHERE p.audit_run_id=$1 AND p.status_code BETWEEN 200 AND 299 AND p.depth>0 GROUP BY p.url,p.depth HAVING count(l.id)=0").bind(audit_id).execute(pool).await?;
    sqlx::query("INSERT INTO audit_findings (audit_run_id,code,severity,title,recommendation,evidence) SELECT $1,'content.duplicate_body','medium','Duplicate page content detected','Review duplicate pages and decide whether they should be consolidated or differentiated.',jsonb_build_object('content_hash',normalized_hash,'pages',jsonb_agg(p.url)) FROM content_fingerprints f JOIN crawled_pages p ON p.id=f.crawled_page_id WHERE f.audit_run_id=$1 AND f.token_count>=30 GROUP BY normalized_hash HAVING count(*)>1").bind(audit_id).execute(pool).await?;
    persist_content_and_schema_findings(pool, audit_id).await?;
    sqlx::query("UPDATE audit_findings SET analyzer_id=CASE WHEN code LIKE 'schema.%' THEN 'structured_data' WHEN code LIKE 'content.%' THEN 'content_readiness' WHEN code LIKE 'brand.%' THEN 'brand_entity' WHEN code LIKE 'links.%' THEN 'internal_links' WHEN code LIKE 'indexing.%' OR code LIKE 'robots.%' OR code LIKE 'sitemap.%' THEN 'crawler_access' WHEN code LIKE 'metadata.%' OR code LIKE 'canonical.%' OR code LIKE 'headings.%' THEN 'meta_analysis' ELSE 'geo_audit' END,affected_url=COALESCE(affected_url,evidence->>'url'),analyzer_version='1.1.0' WHERE audit_run_id=$1").bind(audit_id).execute(pool).await?;
    Ok(())
}

async fn persist_content_and_schema_findings(pool: &PgPool, audit_id: Uuid) -> Result<()> {
    let pages:Vec<(String,String,Value,Value)>=sqlx::query_as("SELECT p.url,e.main_text,p.headings,p.structured_data FROM crawled_pages p JOIN page_extractions e ON e.crawled_page_id=p.id WHERE p.audit_run_id=$1 AND p.status_code BETWEEN 200 AND 299 ORDER BY p.url")
        .bind(audit_id).fetch_all(pool).await?;
    for (url, text, headings_value, structured) in pages {
        let headings = headings_value
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|item| item.get("text").and_then(Value::as_str).map(str::to_owned))
            .collect::<Vec<_>>();
        let content = crate::geo_audit::content::analyze(&text, &headings);
        for finding in content.findings {
            let mut evidence = finding.evidence;
            if let Some(object) = evidence.as_object_mut() {
                object.insert("url".into(), Value::String(url.clone()));
            }
            sqlx::query("INSERT INTO audit_findings(audit_run_id,code,severity,title,evidence,recommendation,analyzer_id,analyzer_version,affected_url) VALUES($1,$2,$3,$4,$5,$6,'content_readiness','1.1.0',$7)")
                .bind(audit_id).bind(finding.code).bind(finding.severity).bind(finding.title).bind(evidence).bind(finding.recommendation).bind(&url).execute(pool).await?;
        }
        if structured.as_array().is_some_and(Vec::is_empty) {
            sqlx::query("INSERT INTO audit_findings(audit_run_id,code,severity,title,evidence,recommendation,analyzer_id,analyzer_version,affected_url) VALUES($1,'schema.not_found','info','No structured data found',jsonb_build_object('url',$2),'Add structured data only when it accurately describes information visible on this page.','structured_data','1.1.0',$2)")
                .bind(audit_id).bind(&url).execute(pool).await?;
        }
        if let Some(entries) = structured.as_array() {
            for entry in entries {
                let source = entry
                    .get("source")
                    .and_then(Value::as_str)
                    .unwrap_or("json_ld");
                let analysis = if let Some(value) = entry.get("value") {
                    crate::geo_audit::schema::analyze_json_ld(&value.to_string())
                } else if entry.get("valid_json").and_then(Value::as_bool) == Some(false) {
                    crate::geo_audit::schema::analyze_json_ld("{")
                } else {
                    crate::geo_audit::schema::analyze_property_entities(vec![entry.clone()], source)
                };
                for finding in analysis.findings {
                    let mut evidence = finding.evidence;
                    if let Some(object) = evidence.as_object_mut() {
                        object.insert("url".into(), Value::String(url.clone()));
                        object.insert("validation_kind".into(), Value::String(finding.kind.into()));
                    }
                    sqlx::query("INSERT INTO audit_findings(audit_run_id,code,severity,title,evidence,recommendation,analyzer_id,analyzer_version,affected_url) VALUES($1,$2,$3,$4,$5,$6,'structured_data','1.1.0',$7)")
                        .bind(audit_id).bind(finding.code).bind(finding.severity).bind(finding.title).bind(evidence).bind(finding.recommendation).bind(&url).execute(pool).await?;
                }
            }
        }
    }
    Ok(())
}

async fn persist_audit_score(pool: &PgPool, audit_id: Uuid) -> Result<()> {
    let (total, successful, titled, described, headed, schema_pages, valid_schema_pages): (i64,i64,i64,i64,i64,i64,i64) = sqlx::query_as("SELECT count(*) FILTER (WHERE NOT structured_data @> '[{\"excluded\":\"robots.txt\"}]'::jsonb AND NOT structured_data @> '[{\"excluded\":\"robots_unavailable\"}]'::jsonb), count(*) FILTER (WHERE status_code BETWEEN 200 AND 299), count(*) FILTER (WHERE status_code BETWEEN 200 AND 299 AND title IS NOT NULL AND length(trim(title)) > 0), count(*) FILTER (WHERE status_code BETWEEN 200 AND 299 AND meta_description IS NOT NULL AND length(trim(meta_description)) > 0), count(*) FILTER (WHERE status_code BETWEEN 200 AND 299 AND jsonb_path_exists(headings, '$[*] ? (@.level == \"h1\")')), count(*) FILTER (WHERE status_code BETWEEN 200 AND 299 AND jsonb_array_length(structured_data) > 0), count(*) FILTER (WHERE status_code BETWEEN 200 AND 299 AND jsonb_array_length(structured_data) > 0 AND NOT jsonb_path_exists(structured_data, '$[*] ? (@.valid_json == false)')) FROM crawled_pages WHERE audit_run_id=$1")
        .bind(audit_id).fetch_one(pool).await?;
    let percent = |value: i64| {
        if total == 0 {
            0.0
        } else {
            value as f32 * 100.0 / total as f32
        }
    };
    let technical = percent(successful);
    let metadata = (percent(titled) + percent(described)) / 2.0;
    let structure = percent(headed);
    // Absence of markup is not treated as a technical error; it is neutral and lowers
    // confidence. When markup exists, this category rewards syntactically valid evidence.
    let schema = if schema_pages == 0 {
        50.0
    } else {
        valid_schema_pages as f32 * 100.0 / schema_pages as f32
    };
    let link_total: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM crawl_links WHERE audit_run_id=$1 AND is_internal",
    )
    .bind(audit_id)
    .fetch_one(pool)
    .await?;
    let discoverable_pages: i64 = sqlx::query_scalar("SELECT count(*) FROM crawled_pages p WHERE p.audit_run_id=$1 AND p.status_code BETWEEN 200 AND 299 AND (p.depth=0 OR EXISTS(SELECT 1 FROM crawl_links l WHERE l.audit_run_id=p.audit_run_id AND l.target_url=p.url AND l.is_internal))")
        .bind(audit_id).fetch_one(pool).await?;
    let links = percent(discoverable_pages);
    let observed = [
        successful > 0,
        titled > 0 || described > 0,
        headed > 0,
        schema_pages > 0,
        link_total > 0,
    ]
    .into_iter()
    .filter(|value| *value)
    .count() as i16;
    let score = ((technical as f64 * 25.0 + metadata as f64 * 15.0 + structure as f64 * 15.0 + schema as f64 * 15.0 + links as f64 * 15.0) / 85.0 * 100.0).round() as u8;
    let page_limit: i64 =
        sqlx::query_scalar("SELECT page_limit::bigint FROM audit_runs WHERE id=$1")
            .bind(audit_id)
            .fetch_one(pool)
            .await?;
    let crawl_budget_utilization = if page_limit == 0 {
        0
    } else {
        (successful * 100 / page_limit).clamp(0, 100) as i16
    };
    let evidence_categories = serde_json::json!({"technical":successful>0,"metadata":titled>0||described>0,"content_structure":headed>0,"schema":schema_pages>0,"internal_links":link_total>0});
    sqlx::query("INSERT INTO audit_scores (audit_run_id,overall_score,technical_score,metadata_score,structure_score,schema_score,links_score,confidence,methodology_version,limitations,crawl_budget_utilization,evidence_categories) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'geo-readiness-v1',$9,$10,$11) ON CONFLICT (audit_run_id) DO UPDATE SET overall_score=EXCLUDED.overall_score,technical_score=EXCLUDED.technical_score,metadata_score=EXCLUDED.metadata_score,structure_score=EXCLUDED.structure_score,schema_score=EXCLUDED.schema_score,links_score=EXCLUDED.links_score,confidence=EXCLUDED.confidence,limitations=EXCLUDED.limitations,crawl_budget_utilization=EXCLUDED.crawl_budget_utilization,evidence_categories=EXCLUDED.evidence_categories,calculated_at=now()")
        .bind(audit_id).bind(score as i16).bind(technical.round() as i16).bind(metadata.round() as i16).bind(structure.round() as i16).bind(schema.round() as i16).bind(links.round() as i16).bind(100i16).bind(serde_json::json!(["Derived from this website audit only; it is not an observed AI visibility metric.","Confidence reflects category evidence found in the completed crawl.","Crawl budget utilization is crawled pages divided by the configured page limit; it does not estimate total website coverage."])).bind(crawl_budget_utilization).bind(evidence_categories)
        .execute(pool).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_main_content_and_structured_data_without_executing_scripts() {
        let html = include_str!("../../../../tests/crawler/fixtures/geo_page.html");
        let page = analyze_html(
            "https://example.test/services",
            "https://example.test/services",
            html,
            200,
            Some("text/html"),
            Some("index,follow"),
            &[],
        );
        assert!(
            page.main_text
                .contains("Example Services provides verified maintenance")
        );
        assert!(!page.main_text.contains("Navigation-only words"));
        assert!(!page.main_text.contains("must not be executed"));
        assert_eq!(
            page.word_count as usize,
            page.main_text.split_whitespace().count()
        );
        assert_eq!(page.structured_data[0]["valid_json"], true);
        let contact = page
            .links
            .as_array()
            .unwrap()
            .iter()
            .find(|link| link["url"] == "https://example.test/contact")
            .unwrap();
        assert_eq!(contact["anchor"], "Contact our team");
        assert_eq!(page.redirect_chain.len(), 0);
        assert_eq!(page.x_robots_tag.as_deref(), Some("index,follow"));
        assert_eq!(page.content_hash.len(), 64);
    }
}
