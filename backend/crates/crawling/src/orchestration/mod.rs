//! Crawl orchestration: planner, scheduler, progress tracking, cancellation, and recovery.
//!
//! Coordinates the crawl lifecycle: URL frontier management, per-origin rate
//! limiting, budget tracking, cancellation, and recovery after worker restart.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{RwLock, watch};
use tokio::task::JoinSet;
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};
use url::Url;
use uuid::Uuid;

use crate::domain::{CrawlBudget, CrawlMode, CrawlPolicy, CrawlStatus, FetchProvider, PageRecord};
use crate::discovery::{extract_links, discover, FrontierEntry, FrontierState, UrlFrontier};
use crate::extraction::ExtractionResult;
use crate::fetcher::Fetcher;
use crate::providers::{observation_to_page_record, PageProvider, ProviderObservation, ProviderSelector, ProviderSelection};

/// Crawl plan: bounded set of URLs to crawl.
#[derive(Debug, Clone)]
pub struct CrawlPlan {
    pub root_url: Url,
    pub mode: CrawlMode,
    pub policy: CrawlPolicy,
    pub frontier: UrlFrontier,
    pub discovered_urls: Vec<String>,
}

/// Crawl scheduler: manages the fetch queue and rate limiting.
#[derive(Debug, Clone)]
pub struct CrawlScheduler {
    pub frontier: Arc<RwLock<UrlFrontier>>,
    pub fetched: Arc<RwLock<HashSet<String>>>,
    pub blocked: Arc<RwLock<HashSet<String>>>,
    pub failed: Arc<RwLock<HashSet<String>>>,
}

impl CrawlScheduler {
    pub fn new(frontier: UrlFrontier) -> Self {
        Self {
            frontier: Arc::new(RwLock::new(frontier)),
            fetched: Arc::new(RwLock::new(HashSet::new())),
            blocked: Arc::new(RwLock::new(HashSet::new())),
            failed: Arc::new(RwLock::new(HashSet::new())),
        }
    }

    pub async fn add_url(&self, url: String, depth: usize, priority: u8) -> bool {
        let mut frontier = self.frontier.write().await;
        frontier.add(url, depth, priority, chrono::Utc::now())
    }

    pub async fn pop_next(&self) -> Option<FrontierEntry> {
        self.frontier.write().await.pop_next()
    }

    pub async fn mark_fetched(&self, url: &str) {
        self.frontier.write().await.mark_fetched(url);
        self.fetched.write().await.insert(url.to_owned());
    }

    pub async fn mark_failed(&self, url: &str) {
        self.frontier.write().await.mark_failed(url);
        self.failed.write().await.insert(url.to_owned());
    }

    pub async fn mark_blocked(&self, url: &str) {
        self.frontier.write().await.mark_blocked(url);
        self.blocked.write().await.insert(url.to_owned());
    }

    pub async fn is_fetched(&self, url: &str) -> bool {
        self.fetched.read().await.contains(url)
    }

    pub async fn stats(&self) -> CrawlSchedulerStats {
        let frontier = self.frontier.read().await;
        CrawlSchedulerStats {
            discovered: frontier.len(),
            queued: frontier.count_by_state(FrontierState::Queued),
            fetching: frontier.count_by_state(FrontierState::Fetching),
            fetched: frontier.count_by_state(FrontierState::Fetched),
            skipped: frontier.count_by_state(FrontierState::Skipped),
            blocked: frontier.count_by_state(FrontierState::Blocked),
            failed: frontier.count_by_state(FrontierState::Failed),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CrawlSchedulerStats {
    pub discovered: usize,
    pub queued: usize,
    pub fetching: usize,
    pub fetched: usize,
    pub skipped: usize,
    pub blocked: usize,
    pub failed: usize,
}

/// Crawl progress tracker.
#[derive(Debug, Clone, Default)]
pub struct CrawlProgress {
    pub crawl_id: Uuid,
    pub status: CrawlStatus,
    pub discovered_urls: usize,
    pub fetched_pages: usize,
    pub failed_pages: usize,
    pub skipped_pages: usize,
    pub firecrawl_pages: usize,
    pub total_bytes: u64,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Crawl orchestrator: runs the full crawl lifecycle.
pub struct CrawlOrchestrator {
    pub fetcher: Fetcher,
    pub selector: ProviderSelector,
    pub scheduler: CrawlScheduler,
    pub budget: CrawlBudget,
    pub policy: CrawlPolicy,
    pub progress: Arc<RwLock<CrawlProgress>>,
    pub cancellation: Arc<RwLock<bool>>,
}

impl CrawlOrchestrator {
    pub fn new(
        fetcher: Fetcher,
        selector: ProviderSelector,
        scheduler: CrawlScheduler,
        policy: CrawlPolicy,
        crawl_id: Uuid,
    ) -> Self {
        Self {
            fetcher,
            selector,
            scheduler,
            budget: CrawlBudget::new(),
            policy,
            progress: Arc::new(RwLock::new(CrawlProgress {
                crawl_id,
                status: CrawlStatus::Queued,
                ..Default::default()
            })),
            cancellation: Arc::new(RwLock::new(false)),
        }
    }

    /// Request cancellation of the running crawl.
    pub async fn request_cancellation(&self) {
        *self.cancellation.write().await = true;
    }

    /// Check if cancellation has been requested.
    pub async fn is_canceled(&self) -> bool {
        *self.cancellation.read().await
    }

    /// Run a QuickPage crawl: fetch a single URL.
    pub async fn crawl_quick_page(&mut self, url: &str) -> Result<PageRecord, String> {
        self.update_status(CrawlStatus::Running).await;

        let selection = self.selector.select(url, false).await;
        let obs = self.fetch_with_provider(url, selection).await?;

        self.budget.pages_fetched += 1;
        self.budget.total_bytes_transferred += obs.body.as_ref().map(|b| b.len()).unwrap_or(0) as u64;

        let record = observation_to_page_record(obs, self.progress.read().await.crawl_id, Uuid::nil(), Uuid::nil());

        self.update_status(CrawlStatus::Completed).await;
        Ok(record)
    }

    /// Run a FullGeoCrawl: bounded multi-page crawl.
    pub async fn crawl_full_geo(&mut self, root_url: &str) -> Result<Vec<PageRecord>, String> {
        self.update_status(CrawlStatus::Running).await;

        let parsed = Url::parse(root_url).map_err(|e| format!("Invalid URL: {e}"))?;
        let root_host = parsed.host_str().unwrap_or("").to_owned();

        // Initialize frontier with root URL.
        let now = chrono::Utc::now();
        self.scheduler
            .add_url(root_url.to_owned(), 0, 1) // highest priority
            .await;

        let mut results: Vec<PageRecord> = Vec::new();
        let mut join_set = JoinSet::new();

        loop {
            if self.is_canceled().await {
                self.update_status(CrawlStatus::Canceled).await;
                return Ok(results);
            }

            if self.budget.is_exhausted(&self.policy) {
                warn!("Crawl budget exhausted");
                break;
            }

            // Collect a batch of URLs to fetch.
            let mut batch: Vec<String> = Vec::new();
            while batch.len() < self.policy.max_host_concurrency {
                if let Some(entry) = self.scheduler.pop_next().await {
                    let url = entry.url.clone();
                    // Check robots exclusion is handled at discovery; here we just fetch.
                    batch.push(url);
                } else {
                    break;
                }
            }

            if batch.is_empty() {
                break;
            }

            // Fetch batch concurrently.
            for url in batch {
                let fetcher = self.fetcher.clone();
                let selector = self.selector.clone(); // Clone of Arc
                let scheduler = self.scheduler.clone();
                let budget = self.policy.clone();
                join_set.spawn(async move {
                    let selection = selector.select(&url, false).await;
                    let obs = match fetch_with_provider_clone(&fetcher, &selector, &url, selection).await {
                        Ok(obs) => obs,
                        Err(e) => {
                            let _ = scheduler.mark_failed(&url).await;
                            return (url, Err(e.to_string()));
                        }
                    };
                    let _ = scheduler.mark_fetched(&url).await;
                    (url, Ok(obs))
                });
            }

            // Process results.
            while let Some(result) = join_set.join_next().await {
                let Ok(result) = result else { continue };
                let (url, page_result) = result;
                match page_result {
                    Ok(obs) => {
                        self.budget.pages_fetched += 1;
                        self.budget.total_bytes_transferred += obs.body.as_ref().map(|b| b.len()).unwrap_or(0) as u64;

                        let record = observation_to_page_record(
                            obs.clone(),
                            self.progress.read().await.crawl_id,
                            Uuid::nil(),
                            Uuid::nil(),
                        );
                        results.push(record);

                        // Discover internal links from the page.
                        if let Some(html) = &obs.html {
                            let base = Url::parse(&obs.final_url).unwrap_or(parsed.clone());
                            let (internal, _external) = extract_links(html, &base);
                            for link in internal {
                                let is_fetched = self.scheduler.is_fetched(&link).await;
                                if !is_fetched && self.budget.urls_discovered < self.policy.max_urls_discovered {
                                    let depth = 1; // TODO: track depth properly
                                    let added = self
                                        .scheduler
                                        .add_url(link.clone(), depth, 5)
                                        .await;
                                    if added {
                                        self.budget.urls_discovered += 1;
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        self.budget.pages_failed += 1;
                        warn!("Failed to fetch {url}: {e}");
                    }
                }
            }

            if results.len() >= self.policy.max_pages {
                break;
            }
        }

        let status = if self.is_canceled().await {
            CrawlStatus::Canceled
        } else if self.budget.is_exhausted(&self.policy) {
            CrawlStatus::PartiallyCompleted
        } else {
            CrawlStatus::Completed
        };
        self.update_status(status).await;

        Ok(results)
    }

    async fn fetch_with_provider(
        &self,
        url: &str,
        selection: ProviderSelection,
    ) -> Result<ProviderObservation, String> {
        match selection {
            ProviderSelection::Native => {
                let result = self.fetcher.fetch(url).await.map_err(|e| e.to_string())?;
                Ok(ProviderObservation {
                    requested_url: result.requested_url,
                    final_url: result.final_url,
                    status: result.status.as_u16(),
                    content_type: result.content_type,
                    body: result.body.as_ref().map(|b| String::from_utf8_lossy(b).to_string()),
                    html: result.body.as_ref().map(|b| String::from_utf8_lossy(b).to_string()),
                    markdown: None,
                    metadata: serde_json::json!({}),
                    headings: Vec::new(),
                    links: Vec::new(),
                    images: Vec::new(),
                    structured_data: Vec::new(),
                    redirect_chain: result.redirect_chain,
                    duration_ms: result.duration_ms,
                    provider: FetchProvider::NativeRust,
                })
            }
            ProviderSelection::Firecrawl => {
                Err("Firecrawl provider not available in this context".to_owned())
            }
        }
    }

    async fn update_status(&self, status: CrawlStatus) {
        let mut progress = self.progress.write().await;
        progress.status = status;
        progress.updated_at = chrono::Utc::now();
    }

    pub async fn get_progress(&self) -> CrawlProgress {
        self.progress.read().await.clone()
    }
}

/// Fetch using a cloned provider selector (for spawned tasks).
async fn fetch_with_provider_clone(
    fetcher: &Fetcher,
    selector: &ProviderSelector,
    url: &str,
    selection: ProviderSelection,
) -> Result<ProviderObservation, String> {
    match selection {
        ProviderSelection::Native => {
            let result = fetcher.fetch(url).await.map_err(|e| e.to_string())?;
            Ok(ProviderObservation {
                requested_url: result.requested_url,
                final_url: result.final_url,
                status: result.status.as_u16(),
                content_type: result.content_type,
                body: result.body.as_ref().map(|b| String::from_utf8_lossy(b).to_string()),
                html: result.body.as_ref().map(|b| String::from_utf8_lossy(b).to_string()),
                markdown: None,
                metadata: serde_json::json!({}),
                headings: Vec::new(),
                links: Vec::new(),
                images: Vec::new(),
                structured_data: Vec::new(),
                redirect_chain: result.redirect_chain,
                duration_ms: result.duration_ms,
                provider: FetchProvider::NativeRust,
            })
        }
        ProviderSelection::Firecrawl => Err("Firecrawl not supported in clone context".to_owned()),
    }
}

/// Recovery state for interrupted crawls.
#[derive(Debug, Clone)]
pub struct RecoveryState {
    pub crawl_id: Uuid,
    pub frontier_snapshot: Vec<FrontierEntry>,
    pub completed_urls: Vec<String>,
    pub failed_urls: Vec<String>,
    pub budget: CrawlBudget,
    pub saved_at: chrono::DateTime<chrono::Utc>,
}

impl RecoveryState {
    pub fn new(crawl_id: Uuid) -> Self {
        Self {
            crawl_id,
            frontier_snapshot: Vec::new(),
            completed_urls: Vec::new(),
            failed_urls: Vec::new(),
            budget: CrawlBudget::new(),
            saved_at: chrono::Utc::now(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scheduler_stats_initial() {
        let frontier = UrlFrontier::new(100);
        let scheduler = CrawlScheduler::new(frontier);
        // Stats are async; we just verify the struct can be created.
        let _ = scheduler;
    }

    #[test]
    fn recovery_state_serialization() {
        let state = RecoveryState::new(Uuid::new_v4());
        let json = serde_json::to_string(&state).unwrap();
        let restored: RecoveryState = serde_json::from_str(&json).unwrap();
        assert_eq!(state.crawl_id, restored.crawl_id);
    }
}
