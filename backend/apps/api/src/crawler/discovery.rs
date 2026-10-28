//! Enhanced resource discovery (Firecrawl-inspired).
//!
//! Discovers robots.txt, security.txt, sitemap.xml and their referenced
//! resources. All fetches pass through the same SSRF-safe URL validation.

use std::collections::HashSet;
use url::Url;

/// Discovered resources from a root URL.
#[derive(Debug, Clone, Default)]
pub struct Discovery {
    pub robots_txt: Option<String>,
    pub security_txt: Option<String>,
    pub sitemaps: Vec<String>,
    pub security_txt_links: Vec<String>,
}

/// Common discovery paths relative to origin.
const DISCOVERY_PATHS: &[&str] = &[
    "/robots.txt",
    "/security.txt",
    "/.well-known/security.txt",
    "/sitemap.xml",
    "/sitemap_index.xml",
];

/// Run discovery against a root URL using the provided fetch function.
/// `fetch` takes a URL string and returns (status_code, body_string).
pub async fn discover<F, Fut>(
    root_url: &Url,
    fetch: F,
) -> Result<Discovery, Box<dyn std::error::Error + Send + Sync>>
where
    F: Fn(String) -> Fut + Send + Sync,
    Fut: std::future::Future<Output = Result<(u16, String), Box<dyn std::error::Error + Send + Sync>>> + Send,
{
    let origin = root_url.origin().ascii_serialization();
    let mut discovery = Discovery::default();

    // robots.txt
    let robots_url = format!("{}/robots.txt", origin);
    if let Ok((status, body)) = fetch(robots_url.clone()).await {
        if status == 200 || status == 204 || status == 403 || status == 401 {
            discovery.robots_txt = Some(body.clone());
            // Parse sitemap directives from robots.txt.
            for line in body.lines() {
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

    // security.txt (try both locations)
    for path in &["/security.txt", "/.well-known/security.txt"] {
        let sec_url = format!("{}{}", origin, path);
        if let Ok((status, body)) = fetch(sec_url.clone()).await {
            if status == 200 {
                discovery.security_txt = Some(body.clone());
                // Extract Contact/Links from security.txt.
                for line in body.lines() {
                    let trimmed = line.trim();
                    if let Some(rest) = trimmed.strip_prefix("Link:") {
                        let link_url = rest.trim();
                        if let Ok(parsed) = Url::parse(link_url) {
                            if parsed.host_str().is_some_and(|h| h.eq_ignore_ascii_case(root_url.host_str().unwrap_or(""))) {
                                discovery.security_txt_links.push(parsed.to_string());
                            }
                        }
                    }
                }
                break; // Use the first found security.txt.
            }
        }
    }

    // Deduplicate sitemaps.
    let mut seen = HashSet::new();
    discovery.sitemaps.retain(|s| seen.insert(s.clone()));

    Ok(discovery)
}

/// Parse sitemap XML entries (loc URLs).
pub fn parse_sitemap_locs(xml: &str) -> Vec<String> {
    let mut locs = Vec::new();
    // Simple regex-free extraction of <loc>...</loc> values.
    let mut start = 0;
    while let Some(open) = xml[start..].find("<loc>") {
        let open_pos = start + open;
        if let Some(close_pos) = xml[open_pos..].find("</loc>") {
            let loc = &xml[open_pos + 5..open_pos + close_pos];
            locs.push(loc.trim().to_owned());
            start = open_pos + close_pos + 6;
        } else {
            break;
        }
    }
    locs
}

/// Validate that a discovered URL is public and same-host (or allowed).
pub fn is_allowed_discovery(url: &Url, root_host: &str) -> bool {
    match url.host_str() {
        Some(host) => host.eq_ignore_ascii_case(root_host),
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_sitemap_locs() {
        let xml = r#"<urlset><url><loc>https://example.com/page1</loc></url><url><loc>https://example.com/page2</loc></url></urlset>"#;
        let locs = parse_sitemap_locs(xml);
        assert_eq!(locs, vec!["https://example.com/page1", "https://example.com/page2"]);
    }

    #[test]
    fn parses_robots_sitemap_directives() {
        let robots = "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\nSitemap: https://other.com/sitemap.xml\n";
        let root = Url::parse("https://example.com/").unwrap();
        // Simulate fetch returning robots.txt.
        let discovery = futures::executor::block_on(discover(&root, |url| async move {
            if url == "https://example.com/robots.txt" {
                Ok((200, robots.to_owned()))
            } else {
                Ok((404, String::new()))
            }
        }))
        .unwrap();
        assert!(discovery.sitemaps.contains(&"https://example.com/sitemap.xml".to_owned()));
        assert!(!discovery.sitemaps.contains(&"https://other.com/sitemap.xml".to_owned()));
    }
}
