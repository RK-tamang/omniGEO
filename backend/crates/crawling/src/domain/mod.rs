//! Domain types for the crawling engine.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use url::Url;
use uuid::Uuid;

/// A crawl request submitted through the REST API.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlRequest {
    pub project_id: Uuid,
    pub url: String,
    pub mode: CrawlMode,
    pub max_pages: Option<usize>,
    pub max_depth: Option<usize>,
    pub use_firecrawl_fallback: Option<bool>,
}

/// Crawl execution mode.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CrawlMode {
    /// Analyze a single permitted page.
    QuickPage,
    /// Retrieve robots.txt, sitemap inventory, URL candidates only.
    DiscoveryOnly,
    /// Crawl an allowlisted list of project URLs.
    TargetedCrawl,
    /// Full GEO crawl within page/depth/time/transfer budgets.
    FullGeoCrawl,
    /// Revalidate existing resources using conditional fetch logic.
    RefreshCrawl,
    /// Firecrawl-enhanced scrape for a single page.
    FirecrawlEnhancedPage,
}

impl Default for CrawlMode {
    fn default() -> Self {
        CrawlMode::FullGeoCrawl
    }
}

/// Result of a crawl run.
#[derive(Debug, Clone, Serialize)]
pub struct CrawlResult {
    pub crawl_id: Uuid,
    pub job_id: Uuid,
    pub status: CrawlStatus,
    pub requested_url: String,
    pub canonical_url: String,
    pub pages_discovered: usize,
    pub pages_fetched: usize,
    pub pages_failed: usize,
    pub pages_skipped: usize,
    pub firecrawl_pages: usize,
    pub total_bytes: u64,
    pub duration_ms: u64,
    pub coverage_notes: Vec<String>,
}

/// Crawl lifecycle status.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CrawlStatus {
    #[default]
    Queued,
    Running,
    Completed,
    PartiallyCompleted,
    Failed,
    Canceled,
}

/// Crawl safety and scope policy.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlPolicy {
    /// Maximum pages to fetch in a single crawl.
    pub max_pages: usize,
    /// Maximum crawl depth from the root URL.
    pub max_depth: usize,
    /// Maximum HTTP redirects to follow.
    pub max_redirects: usize,
    /// Maximum HTML body bytes per page.
    pub max_html_size_bytes: usize,
    /// Request timeout in seconds.
    pub request_timeout_seconds: u64,
    /// Maximum host concurrency.
    pub max_host_concurrency: usize,
    /// Minimum delay between host requests in milliseconds.
    pub min_delay_between_host_requests_ms: u64,
    /// Maximum total crawl duration in seconds.
    pub max_crawl_duration_seconds: u64,
    /// Maximum total transferred bytes.
    pub max_total_transferred_bytes: u64,
    /// Maximum URLs discovered (not necessarily fetched).
    pub max_urls_discovered: usize,
    /// Maximum sitemap XML size in bytes.
    pub max_sitemap_size_bytes: usize,
    /// Maximum retry attempts per fetch.
    pub max_retry_attempts: u32,
    /// Maximum robots.txt response size in bytes.
    pub max_robots_size_bytes: usize,
    /// Firecrawl credit allowance per crawl (micro-USD).
    pub firecrawl_credit_allowance_micro_usd: Option<i64>,
}

impl Default for CrawlPolicy {
    fn default() -> Self {
        Self {
            max_pages: 25,
            max_depth: 2,
            max_redirects: 5,
            max_html_size_bytes: 2_097_152,
            request_timeout_seconds: 10,
            max_host_concurrency: 1,
            min_delay_between_host_requests_ms: 1000,
            max_crawl_duration_seconds: 180,
            max_total_transferred_bytes: 50_000_000,
            max_urls_discovered: 5_000,
            max_sitemap_size_bytes: 5_242_880,
            max_retry_attempts: 3,
            max_robots_size_bytes: 1_048_576,
            firecrawl_credit_allowance_micro_usd: None,
        }
    }
}

/// Crawl budget tracking.
#[derive(Debug, Clone)]
pub struct CrawlBudget {
    pub pages_fetched: usize,
    pub pages_failed: usize,
    pub pages_skipped: usize,
    pub total_bytes_transferred: u64,
    pub urls_discovered: usize,
    pub firecrawl_credits_used_micro_usd: i64,
    pub start_time: std::time::Instant,
}

impl CrawlBudget {
    pub fn new() -> Self {
        Self {
            pages_fetched: 0,
            pages_failed: 0,
            pages_skipped: 0,
            total_bytes_transferred: 0,
            urls_discovered: 0,
            firecrawl_credits_used_micro_usd: 0,
            start_time: std::time::Instant::now(),
        }
    }

    pub fn elapsed_seconds(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }

    pub fn remaining_seconds(&self, policy: &CrawlPolicy) -> u64 {
        self.start_time
            .elapsed()
            .as_secs()
            .saturating_sub(policy.max_crawl_duration_seconds)
    }

    pub fn is_exhausted(&self, policy: &CrawlPolicy) -> bool {
        self.pages_fetched >= policy.max_pages
            || self.total_bytes_transferred >= policy.max_total_transferred_bytes
            || self.urls_discovered >= policy.max_urls_discovered
            || self.elapsed_seconds() >= policy.max_crawl_duration_seconds
    }
}

/// A single page record extracted from a crawl.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageRecord {
    pub id: Uuid,
    pub crawl_run_id: Uuid,
    pub organization_id: Uuid,
    pub project_id: Uuid,
    pub requested_url: String,
    pub final_url: String,
    pub canonical_url: String,
    pub fetch_provider: FetchProvider,
    pub http_status: u16,
    pub content_type: Option<String>,
    pub fetched_at: DateTime<Utc>,
    pub duration_ms: u64,
    pub redirect_chain: Vec<String>,
    pub metadata: serde_json::Value,
    pub headings: Vec<HeadingRecord>,
    pub main_content: Option<String>,
    pub links: Vec<LinkRecord>,
    pub images: Vec<ImageRecord>,
    pub structured_data: Vec<serde_json::Value>,
    pub brand_signals: serde_json::Value,
    pub content_fingerprint: Option<String>,
    pub extraction_version: String,
    pub extraction_quality: Option<f64>,
    pub error_status: Option<String>,
}

/// Which provider fetched the page.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FetchProvider {
    NativeRust,
    Firecrawl,
}

/// A heading extracted from a page.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeadingRecord {
    pub level: u8,
    pub text: String,
}

/// A link extracted from a page.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkRecord {
    pub url: String,
    pub anchor_text: Option<String>,
    pub rel: Option<String>,
    pub is_internal: bool,
    pub is_nofollow: bool,
    pub is_sponsored: bool,
    pub is_ugc: bool,
}

/// An image reference from a page.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageRecord {
    pub url: String,
    pub alt_text: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// Content fingerprint for duplicate detection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentFingerprint {
    pub sha256: String,
    pub simhash: Option<String>,
    pub normalized_text_version: String,
}

/// Compute a SHA-256 fingerprint of normalized text.
pub fn compute_content_fingerprint(text: &str) -> String {
    let normalized = text.to_lowercase();
    let mut hasher = Sha256::new();
    hasher.update(normalized.as_bytes());
    let result = hasher.finalize();
    result.iter().map(|b| format!("{b:02x}")).collect()
}

/// A crawl job record for tracking crawl operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlJob {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub project_id: Uuid,
    pub root_url: String,
    pub mode: CrawlMode,
    pub status: String,
    pub pages_discovered: i32,
    pub pages_fetched: i32,
    pub pages_failed: i32,
    pub total_bytes: i64,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
}

/// Validate that a URL is HTTP or HTTPS.
pub fn is_allowed_scheme(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
}

/// Validate that a host is not localhost or private.
pub fn is_safe_host(host: &str) -> bool {
    if host.eq_ignore_ascii_case("localhost") || host.ends_with(".localhost") {
        return false;
    }
    // IPv6 literals are bracketed by the `url` crate.
    let host = host.trim_matches(['[', ']']);
    if let Ok(ip) = host.parse::<std::net::IpAddr>() {
        return answerscope_web_intelligence::safe_url::ensure_public_ip(ip).is_ok();
    }
    true
}

/// Normalize a URL for crawl frontier dedup: strip fragment, default path, sort query.
pub fn normalize_url_for_frontier(url: &mut Url) {
    url.set_fragment(None);
    if url.path().is_empty() {
        url.set_path("/");
    }
}

/// Extract the host from a URL.
pub fn host_of(url: &Url) -> Option<&str> {
    url.host_str()
}

#[cfg(test)]
mod tests {
    use super::*;
    use url::Url;

    #[test]
    fn content_fingerprint_is_deterministic() {
        let a = compute_content_fingerprint("Hello World");
        let b = compute_content_fingerprint("Hello World");
        assert_eq!(a, b);
        assert_eq!(a.len(), 64);
    }

    #[test]
    fn content_fingerprint_is_case_insensitive() {
        let a = compute_content_fingerprint("Hello World");
        let b = compute_content_fingerprint("hello world");
        assert_eq!(a, b);
    }

    #[test]
    fn is_allowed_scheme_rejects_file_and_ftp() {
        assert!(!is_allowed_scheme(&Url::parse("file:///etc/passwd").unwrap()));
        assert!(!is_allowed_scheme(&Url::parse("ftp://example.com").unwrap()));
        assert!(!is_allowed_scheme(&Url::parse("data:text/html,<script>").unwrap()));
        assert!(is_allowed_scheme(&Url::parse("https://example.com").unwrap()));
        assert!(is_allowed_scheme(&Url::parse("http://example.com").unwrap()));
    }

    #[test]
    fn is_safe_host_blocks_localhost() {
        assert!(!is_safe_host("localhost"));
        assert!(!is_safe_host("127.0.0.1"));
        assert!(!is_safe_host("[::1]"));
        assert!(is_safe_host("example.com"));
    }

    #[test]
    fn normalize_url_strips_fragment() {
        let mut url = Url::parse("https://example.com/page#section").unwrap();
        normalize_url_for_frontier(&mut url);
        assert_eq!(url.as_str(), "https://example.com/page");
    }

    #[test]
    fn normalize_url_defaults_path() {
        let mut url = Url::parse("https://example.com").unwrap();
        normalize_url_for_frontier(&mut url);
        assert_eq!(url.path(), "/");
    }
}
