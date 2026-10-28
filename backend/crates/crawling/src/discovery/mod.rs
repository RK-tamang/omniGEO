//! URL discovery: robots.txt parsing, sitemap parsing, link extraction,
//! URL normalization, and the crawl frontier.
//!
//! Reuses `answerscope_web_intelligence::robots` and
//! `answerscope_web_intelligence::sitemap` for parsing.

use std::collections::{HashMap, HashSet, VecDeque};
use serde::{Deserialize, Serialize};
use url::Url;
use http::StatusCode;

use crate::domain::{is_allowed_scheme, is_safe_host, normalize_url_for_frontier};
use crate::security::validate_target;

/// Discovered resources from a root URL.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Discovery {
    pub robots_txt: Option<String>,
    pub security_txt: Option<String>,
    pub sitemaps: Vec<String>,
    pub internal_links: Vec<String>,
    pub external_links: Vec<String>,
}

/// Discovery paths relative to origin.
const DISCOVERY_PATHS: &[&str] = &[
    "/robots.txt",
    "/security.txt",
    "/.well-known/security.txt",
    "/sitemap.xml",
    "/sitemap_index.xml",
];

/// Run discovery against a root URL.
pub async fn discover(
    root_url: &Url,
    fetcher: &crate::fetcher::Fetcher,
) -> Result<Discovery, Box<dyn std::error::Error + Send + Sync>> {
    let origin = root_url.origin().ascii_serialization();
    let mut discovery = Discovery::default();

    // robots.txt
    let robots_url = format!("{}/robots.txt", origin);
    if let Ok(page) = fetcher.fetch(&robots_url).await {
        if page.status.is_success() || page.status == StatusCode::FORBIDDEN {
            let body = page.body.as_deref().unwrap_or(&[]);
            discovery.robots_txt = Some(String::from_utf8_lossy(body).to_string());
            let robots_text = String::from_utf8_lossy(body);
            for line in robots_text.split('\n') {
                let trimmed = line.trim();
                if let Some(rest) = trimmed.strip_prefix("Sitemap:") {
                    let sitemap_url = rest.trim();
                    if let Ok(parsed) = Url::parse(sitemap_url) {
                        if parsed.host_str().is_some_and(|h| h.eq_ignore_ascii_case(root_url.host_str().unwrap_or(""))) {
                            discovery.sitemaps.push(parsed.to_string());
                        }
                    }
                }
            }
        }
    }

    // security.txt
    for path in &["/security.txt", "/.well-known/security.txt"] {
        let sec_url = format!("{}{}", origin, path);
        if let Ok(page) = fetcher.fetch(&sec_url).await {
            if page.status.is_success() {
                discovery.security_txt = Some(String::from_utf8_lossy(&page.body.unwrap_or_default()).to_string());
                break;
            }
        }
    }

    // Deduplicate sitemaps.
    let mut seen = HashSet::new();
    discovery.sitemaps.retain(|s| seen.insert(s.clone()));

    Ok(discovery)
}

/// Parse sitemap XML entries (loc URLs) using the web-intelligence parser.
pub fn parse_sitemap_locs(xml: &str) -> Vec<String> {
    answerscope_web_intelligence::sitemap::parse(xml)
        .entries
        .into_iter()
        .map(|e| e.location)
        .collect()
}

/// Extract links from HTML body.
pub fn extract_links(html: &str, base_url: &Url) -> (Vec<String>, Vec<String>) {
    let mut internal = Vec::new();
    let mut external = Vec::new();
    let document = scraper::Html::parse_document(html);
    let selector = scraper::Selector::parse("a[href]").unwrap();
    let base_host = base_url.host_str().unwrap_or("");

    for element in document.select(&selector) {
        let href = match element.value().attr("href") {
            Some(h) => h,
            None => continue,
        };
        if let Ok(parsed) = base_url.join(href) {
            normalize_url_for_frontier(&mut parsed.clone().into());
            // url::Url doesn't clone into mutable easily; re-parse
            let mut p = parsed.clone();
            normalize_url_for_frontier(&mut p);
            let host = p.host_str().unwrap_or("");
            if host.eq_ignore_ascii_case(base_host) {
                internal.push(p.to_string());
            } else {
                external.push(p.to_string());
            }
        }
    }

    internal.sort_unstable();
    internal.dedup();
    external.sort_unstable();
    external.dedup();

    (internal, external)
}

/// Validate that a discovered URL is public and same-host.
pub fn is_allowed_discovery(url: &Url, root_host: &str) -> bool {
    match url.host_str() {
        Some(host) => host.eq_ignore_ascii_case(root_host) && is_safe_host(host),
        None => false,
    }
}

/// Crawl frontier state for a single URL.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FrontierState {
    Discovered,
    Queued,
    Fetching,
    Fetched,
    Skipped,
    Blocked,
    Failed,
}

/// A frontier entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontierEntry {
    pub url: String,
    pub depth: usize,
    pub state: FrontierState,
    pub priority: u8,
    pub discovered_at: chrono::DateTime<chrono::Utc>,
}

/// Bounded crawl frontier with priority-based scheduling.
#[derive(Debug, Clone, Default)]
pub struct UrlFrontier {
    entries: HashMap<String, FrontierEntry>,
    queue: VecDeque<(u8, String)>, // (priority, url)
    max_urls: usize,
}

impl UrlFrontier {
    pub fn new(max_urls: usize) -> Self {
        Self {
            entries: HashMap::new(),
            queue: VecDeque::new(),
            max_urls,
        }
    }

    /// Add a URL to the frontier if not already present and within limits.
    pub fn add(
        &mut self,
        url: String,
        depth: usize,
        priority: u8,
        now: chrono::DateTime<chrono::Utc>,
    ) -> bool {
        if self.entries.contains_key(&url) {
            return false;
        }
        if self.entries.len() >= self.max_urls {
            return false;
        }
        let entry = FrontierEntry {
            url: url.clone(),
            depth,
            state: FrontierState::Discovered,
            priority,
            discovered_at: now,
        };
        self.entries.insert(url.clone(), entry);
        self.queue.push_back((priority, url));
        true
    }

    /// Pop the highest-priority queued URL.
    pub fn pop_next(&mut self) -> Option<FrontierEntry> {
        // Sort by priority (lower = higher priority), then by insertion order.
        let mut items: Vec<_> = self.queue.drain(..).collect();
        items.sort_by_key(|(p, _)| *p);
        for (priority, url) in items {
            if let Some(entry) = self.entries.get_mut(&url) {
                if entry.state == FrontierState::Discovered || entry.state == FrontierState::Queued {
                    entry.state = FrontierState::Fetching;
                    return Some(entry.clone());
                }
            }
        }
        None
    }

    /// Mark an entry as fetched.
    pub fn mark_fetched(&mut self, url: &str) {
        if let Some(entry) = self.entries.get_mut(url) {
            entry.state = FrontierState::Fetched;
        }
    }

    /// Mark an entry as failed.
    pub fn mark_failed(&mut self, url: &str) {
        if let Some(entry) = self.entries.get_mut(url) {
            entry.state = FrontierState::Failed;
        }
    }

    /// Mark an entry as skipped.
    pub fn mark_skipped(&mut self, url: &str) {
        if let Some(entry) = self.entries.get_mut(url) {
            entry.state = FrontierState::Skipped;
        }
    }

    /// Mark an entry as blocked (e.g., by robots.txt).
    pub fn mark_blocked(&mut self, url: &str) {
        if let Some(entry) = self.entries.get_mut(url) {
            entry.state = FrontierState::Blocked;
        }
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub fn count_by_state(&self, state: FrontierState) -> usize {
        self.entries.values().filter(|e| e.state == state).count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frontier_add_and_pop() {
        let mut frontier = UrlFrontier::new(100);
        let now = chrono::Utc::now();

        assert!(frontier.add("https://example.com/a".to_owned(), 0, 5, now));
        assert!(frontier.add("https://example.com/b".to_owned(), 0, 1, now));
        assert!(frontier.add("https://example.com/a".to_owned(), 0, 5, now)); // duplicate
        assert!(!frontier.is_empty());

        // Higher priority (lower number) pops first.
        let first = frontier.pop_next().unwrap();
        assert_eq!(first.url, "https://example.com/b");
        assert_eq!(first.priority, 1);

        let second = frontier.pop_next().unwrap();
        assert_eq!(second.url, "https://example.com/a");
        assert_eq!(second.priority, 5);

        assert!(frontier.pop_next().is_none());
    }

    #[test]
    fn frontier_max_urls_limit() {
        let mut frontier = UrlFrontier::new(2);
        let now = chrono::Utc::now();
        assert!(frontier.add("https://example.com/a".to_owned(), 0, 5, now));
        assert!(frontier.add("https://example.com/b".to_owned(), 0, 5, now));
        assert!(!frontier.add("https://example.com/c".to_owned(), 0, 5, now));
    }

    #[test]
    fn extract_links_internal_and_external() {
        let html = r#"<html><body>
            <a href="/about">About</a>
            <a href="https://example.com/contact">Contact</a>
            <a href="https://other.com/external">External</a>
        </body></html>"#;
        let base = url::Url::parse("https://example.com/").unwrap();
        let (internal, external) = extract_links(html, &base);
        assert!(internal.iter().any(|u| u.contains("/about")));
        assert!(internal.iter().any(|u| u.contains("/contact")));
        assert!(external.iter().any(|u| u.contains("other.com")));
    }
}
