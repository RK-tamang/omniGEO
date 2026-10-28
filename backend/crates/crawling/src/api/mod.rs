//! Crawl REST API.
//!
//! Exposes the four public crawl operations:
//!   POST /api/v1/crawler/map
//!   POST /api/v1/crawler/scrape
//!   POST /api/v1/crawler/crawl
//!   POST /api/v1/crawler/batch-scrape
//!   GET  /api/v1/crawler/jobs/{id}
//!   GET  /api/v1/crawler/jobs/{id}/results
//!   GET  /api/v1/crawler/jobs/{id}/pages
//!   POST /api/v1/crawler/jobs/{id}/cancel

use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};
use url::Url;
use uuid::Uuid;

use crate::{
    domain::{
        CrawlJob, CrawlMode, FetchProvider, PageRecord,
    },
    discovery::{discover, extract_links, UrlFrontier, FrontierEntry, FrontierState},
    extraction::extract,
    fetcher::Fetcher,
    persistence::{
        list_crawl_pages, lookup_crawl_cache, store_crawl_cache,
        store_content_fingerprint, store_crawl_links, store_crawl_page, upsert_crawl_job,
    },
    providers::observation_to_page_record,
};

/// Crawl API state.
#[derive(Clone)]
pub struct CrawlApiState {
    pub pool: sqlx::PgPool,
    pub fetcher: Fetcher,
    pub active_crawls: Arc<RwLock<HashMap<Uuid, CrawlJob>>>,
}

impl CrawlApiState {
    pub fn new(pool: sqlx::PgPool, fetcher: Fetcher) -> Self {
        Self {
            pool,
            fetcher,
            active_crawls: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

/// Map request body.
#[derive(Debug, Deserialize)]
pub struct MapRequest {
    pub url: String,
    pub max_urls: Option<usize>,
    pub include_external: Option<bool>,
}

/// Map response body.
#[derive(Debug, Serialize)]
pub struct MapResponse {
    pub url: String,
    pub discovered_urls: Vec<DiscoveredUrl>,
    pub robots_txt: Option<String>,
    pub sitemaps: Vec<String>,
    pub summary: MapSummary,
}

/// A discovered URL entry.
#[derive(Debug, Serialize)]
pub struct DiscoveredUrl {
    pub url: String,
    pub depth: usize,
    pub source: String,
    pub canonical_url: String,
    pub in_scope: bool,
    pub robots_eligible: bool,
    pub discovery_confidence: f64,
    pub sitemap_member: bool,
}

/// Map summary.
#[derive(Debug, Serialize)]
pub struct MapSummary {
    pub total_discovered: usize,
    pub in_scope_count: usize,
    pub external_count: usize,
}

/// Scrape request body.
#[derive(Debug, Deserialize)]
pub struct ScrapeRequest {
    pub url: String,
    pub formats: Option<Vec<String>>,
    pub only_main_content: Option<bool>,
}

/// Scrape response body.
#[derive(Debug, Serialize)]
pub struct ScrapeResponse {
    pub url: String,
    pub final_url: String,
    pub status_code: u16,
    pub markdown: Option<String>,
    pub text: Option<String>,
    pub html: Option<String>,
    pub metadata: Value,
    pub headings: Vec<crate::domain::HeadingRecord>,
    pub links: Vec<crate::domain::LinkRecord>,
    pub images: Vec<crate::domain::ImageRecord>,
    pub structured_data: Vec<Value>,
    pub language: Option<String>,
    pub canonical_url: Option<String>,
    pub extraction_method: String,
    pub extraction_quality: Option<f64>,
}

/// Crawl request body.
#[derive(Debug, Deserialize)]
pub struct CrawlRequest {
    pub url: String,
    pub max_pages: Option<usize>,
    pub max_depth: Option<usize>,
    pub respect_robots: Option<bool>,
}

/// Crawl response body.
#[derive(Debug, Serialize)]
pub struct CrawlResponse {
    pub job_id: String,
    pub status: String,
    pub url: String,
}

/// Batch scrape request body.
#[derive(Debug, Deserialize)]
pub struct BatchScrapeRequest {
    pub urls: Vec<String>,
    pub max_concurrent: Option<usize>,
}

/// Batch scrape response body.
#[derive(Debug, Serialize)]
pub struct BatchScrapeResponse {
    pub job_id: String,
    pub submitted_urls: usize,
    pub status: String,
}

/// Job status response.
#[derive(Debug, Serialize)]
pub struct JobStatusResponse {
    pub id: Uuid,
    pub status: String,
    pub pages_discovered: i32,
    pub pages_fetched: i32,
    pub pages_failed: i32,
    pub error_message: Option<String>,
}

/// Job results response.
#[derive(Debug, Serialize)]
pub struct JobResultsResponse {
    pub job_id: Uuid,
    pub pages: Vec<PageSummary>,
}

/// Page summary for job results.
#[derive(Debug, Serialize)]
pub struct PageSummary {
    pub id: Uuid,
    pub url: String,
    pub final_url: String,
    pub status_code: u16,
    pub word_count: usize,
    pub content_fingerprint: String,
}

/// Build the crawl API router.
pub fn router(state: CrawlApiState) -> Router {
    Router::new()
        .route("/api/v1/crawler/map", post(crawl_map))
        .route("/api/v1/crawler/scrape", post(crawl_scrape))
        .route("/api/v1/crawler/crawl", post(crawl_crawl))
        .route("/api/v1/crawler/batch-scrape", post(crawl_batch_scrape))
        .route("/api/v1/crawler/jobs/:id", get(crawl_job_status))
        .route("/api/v1/crawler/jobs/:id/results", get(crawl_job_results))
        .route("/api/v1/crawler/jobs/:id/pages", get(crawl_job_pages))
        .route("/api/v1/crawler/jobs/:id/cancel", post(crawl_job_cancel))
        .with_state(state)
}

/// POST /api/v1/crawler/map
async fn crawl_map(
    State(state): State<CrawlApiState>,
    _headers: HeaderMap,
    Json(input): Json<MapRequest>,
) -> Result<Json<MapResponse>, StatusCode> {
    let parsed_url = Url::parse(&input.url).map_err(|_| StatusCode::BAD_REQUEST)?;
    let root_host = parsed_url.host_str().unwrap_or("").to_owned();

    let max_urls = input.max_urls.unwrap_or(100);
    let include_external = input.include_external.unwrap_or(false);

    // Discovery phase: robots.txt + sitemaps + homepage links
    let discovery = match discover(&parsed_url, &state.fetcher).await {
        Ok(d) => d,
        Err(_) => {
            crate::discovery::Discovery::default()
        }
    };

    let mut discovered: Vec<DiscoveredUrl> = Vec::new();
    let mut seen = HashMap::new();

    // Add sitemap URLs
    for sitemap_url in &discovery.sitemaps {
        if seen.insert(sitemap_url.clone(), true).is_none() {
            discovered.push(DiscoveredUrl {
                url: sitemap_url.clone(),
                depth: 1,
                source: "sitemap".to_owned(),
                canonical_url: sitemap_url.clone(),
                in_scope: true,
                robots_eligible: true,
                discovery_confidence: 0.9,
                sitemap_member: true,
            });
        }
    }

    // Fetch homepage for link discovery
    if let Ok(page) = state.fetcher.fetch(&input.url).await {
        if let Some(body) = &page.body {
            let html = String::from_utf8_lossy(body).to_string();
            let (internal, external) = extract_links(&html, &parsed_url);

            for url in internal {
                if seen.insert(url.clone(), true).is_none() {
                    let p = Url::parse(&url).unwrap_or(parsed_url.clone());
                    discovered.push(DiscoveredUrl {
                        url,
                        depth: 1,
                        source: "homepage_links".to_owned(),
                        canonical_url: p.to_string(),
                        in_scope: true,
                        robots_eligible: true,
                        discovery_confidence: 0.8,
                        sitemap_member: false,
                    });
                }
            }

            if include_external {
                for url in external {
                    if seen.insert(url.clone(), true).is_none() {
                        let p = Url::parse(&url).unwrap_or(parsed_url.clone());
                        discovered.push(DiscoveredUrl {
                            url,
                            depth: 1,
                            source: "homepage_links_external".to_owned(),
                            canonical_url: p.to_string(),
                            in_scope: false,
                            robots_eligible: true,
                            discovery_confidence: 0.5,
                            sitemap_member: false,
                        });
                    }
                }
            }
        }
    }

    // Cap results
    let limited: Vec<DiscoveredUrl> = discovered.into_iter().take(max_urls).collect();

    let summary = MapSummary {
        total_discovered: limited.len(),
        in_scope_count: limited.iter().filter(|u| u.in_scope).count(),
        external_count: limited.iter().filter(|u| !u.in_scope).count(),
    };

    Ok(Json(MapResponse {
        url: input.url,
        discovered_urls: limited,
        robots_txt: discovery.robots_txt,
        sitemaps: discovery.sitemaps,
        summary,
    }))
}

/// POST /api/v1/crawler/scrape
async fn crawl_scrape(
    State(state): State<CrawlApiState>,
    _headers: HeaderMap,
    Json(input): Json<ScrapeRequest>,
) -> Result<Json<ScrapeResponse>, StatusCode> {
    let parsed_url = Url::parse(&input.url).map_err(|_| StatusCode::BAD_REQUEST)?;

    // Check cache first
    let cache_key = input.url.trim().to_lowercase();
    let cached = lookup_crawl_cache(&state.pool, &cache_key).await.ok().flatten();

    let (final_url, status, body, content_type, redirect_chain) =
        if let Some((body_bytes, ct, _hash)) = cached {
            (
                input.url.clone(),
                200u16,
                String::from_utf8_lossy(&body_bytes).to_string(),
                Some(ct),
                Vec::<String>::new(),
            )
        } else {
            let result = state.fetcher.fetch(&input.url).await.map_err(|_| {
                StatusCode::BAD_GATEWAY
            })?;
            (
                result.final_url.clone(),
                result.status.as_u16(),
                String::from_utf8_lossy(&result.body.unwrap_or_default()).to_string(),
                result.content_type.clone(),
                result.redirect_chain,
            )
        };

    let extraction = extract(&body, &parsed_url);

    let markdown = extraction.markdown.clone();
    let text = extraction.main_text.clone();
    let html = Some(body.to_owned());
    let metadata = serde_json::json!({
        "title": extraction.title,
        "description": extraction.meta_description,
        "canonical": extraction.canonical_url,
        "language": extraction.language,
        "robots": extraction.meta_robots,
        "viewport": extraction.viewport,
        "open_graph": extraction.open_graph,
    });

    // Cache the result
    let _ = store_crawl_cache(
        &state.pool,
        &cache_key,
        &format!("{:x}", sha2::Sha256::digest(body.as_bytes())),
        body.as_bytes(),
        content_type.as_deref(),
        chrono::Utc::now() + chrono::Duration::hours(1),
    ).await;

    // Store fingerprint
    let _ = store_content_fingerprint(
        &state.pool,
        Uuid::new_v4(),
        &input.url,
        &extraction.content_fingerprint.sha256,
    ).await;

    Ok(Json(ScrapeResponse {
        url: input.url,
        final_url,
        status_code: status,
        markdown: if input.formats.as_ref().map_or(true, |f| f.contains(&"markdown".to_string())) {
            Some(markdown)
        } else {
            None
        },
        text: if input.formats.as_ref().map_or(true, |f| f.contains(&"text".to_string())) {
            Some(text)
        } else {
            None
        },
        html: if input.formats.as_ref().map_or(true, |f| f.contains(&"html".to_string())) {
            html
        } else {
            None
        },
        metadata,
        headings: extraction.headings,
        links: extraction.links,
        images: extraction.images,
        structured_data: extraction.structured_data,
        language: extraction.language,
        canonical_url: extraction.canonical_url,
        extraction_method: "native_rust_http".to_owned(),
        extraction_quality: extraction.extraction_quality,
    }))
}

/// POST /api/v1/crawler/crawl
async fn crawl_crawl(
    State(state): State<CrawlApiState>,
    _headers: HeaderMap,
    Json(input): Json<CrawlRequest>,
) -> Result<Json<CrawlResponse>, StatusCode> {
    let parsed_url = Url::parse(&input.url).map_err(|_| StatusCode::BAD_REQUEST)?;

    let job_id = Uuid::new_v4();
    let max_pages = input.max_pages.unwrap_or(25);
    let max_depth = input.max_depth.unwrap_or(3);
    let respect_robots = input.respect_robots.unwrap_or(true);

    // Register the job
    let job = CrawlJob {
        id: job_id,
        organization_id: Uuid::nil(),
        project_id: Uuid::nil(),
        root_url: input.url.clone(),
        mode: CrawlMode::FullGeoCrawl,
        status: "queued".to_owned(),
        pages_discovered: 0,
        pages_fetched: 0,
        pages_failed: 0,
        total_bytes: 0,
        created_at: chrono::Utc::now(),
        completed_at: None,
        error_message: None,
    };

    let _ = upsert_crawl_job(&state.pool, &job).await;
    state.active_crawls.write().await.insert(job_id, job.clone());

    // Start crawl in background
    let fetcher = state.fetcher.clone();
    let pool = state.pool.clone();
    let active_crawls = state.active_crawls.clone();
    let input_url_for_response = input.url.clone();

    tokio::spawn(async move {
        let mut fetched = 0;
        let mut discovered = 0;
        let mut failed = 0;
        let mut total_bytes = 0u64;

        let mut frontier = UrlFrontier::new(max_pages * 4);
        let now = chrono::Utc::now();
        let input_url = input.url.clone();
        frontier.add(input_url.clone(), 0, 1, now);

        let mut visited = HashMap::new();
        let mut queue: Vec<(String, usize)> = vec![(input_url.clone(), 0)];

        while !queue.is_empty() && fetched < max_pages {
            let (current_url, depth) = queue.remove(0);

            if depth > max_depth {
                continue;
            }

            if visited.insert(current_url.clone(), true).is_some() {
                continue;
            }

            match fetcher.fetch(&current_url).await {
                Ok(page) => {
                    let body = page.body.as_deref().unwrap_or(&[]);
                    total_bytes += body.len() as u64;

                    let extraction = extract(&String::from_utf8_lossy(&body), &parsed_url);

                    // Persist page
                    let page_record = observation_to_page_record(
                        crate::providers::ProviderObservation {
                            requested_url: current_url.clone(),
                            final_url: page.final_url.clone(),
                            status: page.status.as_u16(),
                            content_type: page.content_type.clone(),
                            body: Some(String::from_utf8_lossy(&body).to_string()),
                            html: Some(String::from_utf8_lossy(&body).to_string()),
                            markdown: Some(extraction.markdown.clone()),
                            metadata: serde_json::json!({
                                "title": extraction.title,
                                "description": extraction.meta_description,
                                "canonical": extraction.canonical_url,
                                "language": extraction.language,
                                "robots": extraction.meta_robots,
                                "viewport": extraction.viewport,
                                "open_graph": extraction.open_graph,
                            }),
                            headings: extraction.headings.clone(),
                            links: extraction.links.clone(),
                            images: extraction.images.clone(),
                            structured_data: extraction.structured_data.clone(),
                            redirect_chain: page.redirect_chain.clone(),
                            duration_ms: page.duration_ms,
                            provider: FetchProvider::NativeRust,
                        },
                        job_id,
                        Uuid::nil(),
                        Uuid::nil(),
                    );

                    let _ = store_crawl_page(&state.pool, &page_record, job_id, Uuid::nil(), Uuid::nil()).await;
                    let _ = store_crawl_links(&state.pool, job_id, &current_url, &extraction.links).await;
                    let _ = store_content_fingerprint(&state.pool, job_id, &current_url, &extraction.content_fingerprint.sha256).await;

                    fetched += 1;
                    discovered += 1;

                    // Discover links for next depth
                    if depth < max_depth {
                        if let Some(html_body) = &page.body {
                            let html = String::from_utf8_lossy(html_body).to_string();
                            let base = Url::parse(&page.final_url).unwrap_or(parsed_url.clone());
                            let (internal, _external) = extract_links(&html, &base);
                            for link in internal {
                                if !visited.contains_key(&link) && queue.len() < max_pages * 2 {
                                    queue.push((link, depth + 1));
                                }
                            }
                        }
                    }
                }
                Err(_) => {
                    failed += 1;
                }
            }

            // Update job progress
            let mut active = active_crawls.write().await;
            if let Some(j) = active.get_mut(&job_id) {
                j.pages_fetched = fetched as i32;
                j.pages_discovered = discovered as i32;
                j.pages_failed = failed as i32;
                j.total_bytes = total_bytes as i64;
            }
            drop(active);

            let current_job = active_crawls.read().await.get(&job_id).cloned().unwrap_or(job.clone());
            let _ = upsert_crawl_job(&state.pool, &current_job).await;
        }

        // Mark completed
        let mut active = active_crawls.write().await;
        if let Some(j) = active.get_mut(&job_id) {
            j.status = "completed".to_owned();
            j.completed_at = Some(chrono::Utc::now());
        }
        drop(active);

        let final_job = active_crawls.read().await.get(&job_id).cloned().unwrap_or(job.clone());
        let _ = upsert_crawl_job(&state.pool, &final_job).await;
    });

    Ok(Json(CrawlResponse {
        job_id: job_id.to_string(),
        status: "queued".to_owned(),
        url: input_url_for_response,
    }))
}

/// POST /api/v1/crawler/batch-scrape
async fn crawl_batch_scrape(
    State(state): State<CrawlApiState>,
    _headers: HeaderMap,
    Json(input): Json<BatchScrapeRequest>,
) -> Result<Json<BatchScrapeResponse>, StatusCode> {
    let job_id = Uuid::new_v4();
    let max_concurrent = input.max_concurrent.unwrap_or(5).min(16);

    // Validate URLs
    let mut valid_urls = Vec::new();
    for url in &input.urls {
        if Url::parse(url).is_ok() {
            valid_urls.push(url.clone());
        }
    }

    if valid_urls.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Register the job
    let job = CrawlJob {
        id: job_id,
        organization_id: Uuid::nil(),
        project_id: Uuid::nil(),
        root_url: format!("batch_scrape:{}", valid_urls.len()),
        mode: CrawlMode::FullGeoCrawl,
        status: "queued".to_owned(),
        pages_discovered: valid_urls.len() as i32,
        pages_fetched: 0,
        pages_failed: 0,
        total_bytes: 0,
        created_at: chrono::Utc::now(),
        completed_at: None,
        error_message: None,
    };

    let _ = upsert_crawl_job(&state.pool, &job).await;
    state.active_crawls.write().await.insert(job_id, job.clone());

    // Start batch scrape in background
    let submitted_urls = valid_urls.len();
    let fetcher = state.fetcher.clone();
    let pool = state.pool.clone();
    let active_crawls = state.active_crawls.clone();

    tokio::spawn(async move {
        let mut fetched = 0;
        let mut failed = 0;
        let mut total_bytes = 0u64;

        let mut join_set = tokio::task::JoinSet::new();

        for url in valid_urls {
            let fetcher = fetcher.clone();
            let pool = pool.clone();
            let job_id = job_id;
            let active_crawls = active_crawls.clone();

            join_set.spawn(async move {
                match fetcher.fetch(&url).await {
                    Ok(page) => {
                        let body = page.body.as_deref().unwrap_or(&[]);
                        let _ = total_bytes;

                        let parsed = Url::parse(&url).unwrap_or_else(|_| Url::parse("https://example.com/").unwrap());
                        let extraction = extract(&String::from_utf8_lossy(body), &parsed);

                        let page_record = observation_to_page_record(
                            crate::providers::ProviderObservation {
                                requested_url: url.clone(),
                                final_url: page.final_url.clone(),
                                status: page.status.as_u16(),
                                content_type: page.content_type.clone(),
                                body: Some(String::from_utf8_lossy(body).to_string()),
                                html: Some(String::from_utf8_lossy(body).to_string()),
                                markdown: Some(extraction.markdown.clone()),
                                metadata: serde_json::json!({
                                    "title": extraction.title,
                                    "description": extraction.meta_description,
                                    "canonical": extraction.canonical_url,
                                    "language": extraction.language,
                                    "robots": extraction.meta_robots,
                                    "viewport": extraction.viewport,
                                    "open_graph": extraction.open_graph,
                                }),
                                headings: extraction.headings.clone(),
                                links: extraction.links.clone(),
                                images: extraction.images.clone(),
                                structured_data: extraction.structured_data.clone(),
                                redirect_chain: page.redirect_chain.clone(),
                                duration_ms: page.duration_ms,
                                provider: FetchProvider::NativeRust,
                            },
                            job_id,
                            Uuid::nil(),
                            Uuid::nil(),
                        );

                        let _ = store_crawl_page(&pool, &page_record, job_id, Uuid::nil(), Uuid::nil()).await;
                        let _ = store_crawl_links(&pool, job_id, &url, &extraction.links).await;

                        (url.clone(), Ok(()))
                    }
                    Err(_) => (url.clone(), Err(())),
                }
            });

            // Limit concurrency
            if join_set.len() >= max_concurrent {
                let _ = join_set.join_next().await;
            }
        }

        // Wait for remaining tasks
        while let Some(result) = join_set.join_next().await {
            match result {
                Ok((_, Ok(()))) => fetched += 1,
                Ok((_, Err(()))) => failed += 1,
                Err(_) => failed += 1,
            }
        }

        // Update progress
        let mut active = active_crawls.write().await;
        if let Some(j) = active.get_mut(&job_id) {
            j.pages_fetched = fetched;
            j.pages_failed = failed;
            j.total_bytes = total_bytes as i64;
            j.status = "completed".to_owned();
            j.completed_at = Some(chrono::Utc::now());
        }
        drop(active);
    });

    Ok(Json(BatchScrapeResponse {
        job_id: job_id.to_string(),
        submitted_urls,
        status: "queued".to_owned(),
    }))
}

/// GET /api/v1/crawler/jobs/{id}
async fn crawl_job_status(
    State(state): State<CrawlApiState>,
    Path(id): Path<Uuid>,
) -> Result<Json<JobStatusResponse>, StatusCode> {
    let active = state.active_crawls.read().await;
    if let Some(job) = active.get(&id) {
        return Ok(Json(JobStatusResponse {
            id: job.id,
            status: job.status.clone(),
            pages_discovered: job.pages_discovered,
            pages_fetched: job.pages_fetched,
            pages_failed: job.pages_failed,
            error_message: job.error_message.clone(),
        }));
    }

    // Fall back to DB
    match get_crawl_job_db(&state.pool, id).await {
        Some(job) => Ok(Json(JobStatusResponse {
            id: job.id,
            status: job.status,
            pages_discovered: job.pages_discovered,
            pages_fetched: job.pages_fetched,
            pages_failed: job.pages_failed,
            error_message: job.error_message,
        })),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// GET /api/v1/crawler/jobs/{id}/results
async fn crawl_job_results(
    State(state): State<CrawlApiState>,
    Path(id): Path<Uuid>,
) -> Result<Json<JobResultsResponse>, StatusCode> {
    let pages = list_crawl_pages(&state.pool, id, 100, 0)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let page_summaries: Vec<PageSummary> = pages
        .into_iter()
        .map(|p| PageSummary {
            id: p.id,
            url: p.requested_url,
            final_url: p.final_url,
            status_code: p.http_status as u16,
            word_count: p.main_content.as_ref().map(|c| c.split_whitespace().count()).unwrap_or(0),
            content_fingerprint: p.content_fingerprint,
        })
        .collect();

    Ok(Json(JobResultsResponse {
        job_id: id,
        pages: page_summaries,
    }))
}

/// GET /api/v1/crawler/jobs/{id}/pages
async fn crawl_job_pages(
    State(state): State<CrawlApiState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, StatusCode> {
    let pages = list_crawl_pages(&state.pool, id, 100, 0)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "job_id": id,
        "pages": pages,
        "count": pages.len(),
    })))
}

/// POST /api/v1/crawler/jobs/{id}/cancel
async fn crawl_job_cancel(
    State(state): State<CrawlApiState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, StatusCode> {
    let mut active = state.active_crawls.write().await;
    if let Some(job) = active.get_mut(&id) {
        job.status = "cancelled".to_owned();
        job.completed_at = Some(chrono::Utc::now());
        return Ok(Json(serde_json::json!({"job_id": id, "status": "cancelled"})));
    }
    drop(active);

    // Try DB
    match get_crawl_job_db(&state.pool, id).await {
        Some(mut job) => {
            job.status = "cancelled".to_owned();
            job.completed_at = Some(chrono::Utc::now());
            let _ = upsert_crawl_job(&state.pool, &crate::domain::CrawlJob {
                id: job.id,
                organization_id: job.organization_id,
                project_id: job.project_id,
                root_url: job.root_url,
                mode: CrawlMode::FullGeoCrawl,
                status: job.status,
                pages_discovered: job.pages_discovered,
                pages_fetched: job.pages_fetched,
                pages_failed: job.pages_failed,
                total_bytes: job.total_bytes,
                created_at: job.created_at,
                completed_at: job.completed_at,
                error_message: job.error_message,
            }).await;
            Ok(Json(serde_json::json!({"job_id": id, "status": "cancelled"})))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn get_crawl_job_db(
    pool: &sqlx::PgPool,
    id: Uuid,
) -> Option<crate::persistence::StoredCrawlJob> {
    sqlx::query_as("SELECT * FROM crawl_jobs_ext WHERE id=$1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}
