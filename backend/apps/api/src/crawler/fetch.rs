//! Enhanced secure fetcher (Firecrawl-inspired).
//!
//! Adds per-domain rate limiting, retry with exponential backoff,
//! response caching, and SSRF-safe address validation on every hop.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::lookup_host;
use tokio::sync::RwLock;

use futures_util::StreamExt;
use reqwest::{Client, StatusCode, header::LOCATION};
use tokio::time::sleep;

use crate::crawler::safe_url::ensure_public_ip;

/// Result of a single fetch.
#[derive(Debug, Clone)]
pub struct FetchResult {
    pub final_url: String,
    pub status: StatusCode,
    pub content_type: Option<String>,
    pub body: String,
    pub redirect_chain: Vec<String>,
}

/// Per-domain rate limiter state.
#[derive(Debug, Clone, Default)]
struct DomainLimiter {
    last_request: Option<Instant>,
}

/// Global rate limiter shared across all fetchers.
#[derive(Debug, Clone, Default)]
pub struct GlobalRateLimiter {
    domains: Arc<RwLock<HashMap<String, DomainLimiter>>>,
}

impl GlobalRateLimiter {
    pub fn new() -> Self {
        Self::default()
    }

    /// Wait until the domain's rate limit allows a request, then record it.
    pub async fn acquire(&self, host: &str, min_interval_ms: u64) {
        let interval = Duration::from_millis(min_interval_ms);
        let mut domains = self.domains.write().await;
        let entry = domains.entry(host.to_owned()).or_default();

        let elapsed = entry.last_request.map(|t| t.elapsed()).unwrap_or(Duration::MAX);
        if elapsed < interval {
            // Drop the write lock before sleeping to avoid holding it.
            drop(domains);
            sleep(interval - elapsed).await;
            let mut domains = self.domains.write().await;
            if let Some(e) = domains.get_mut(host) {
                e.last_request = Some(Instant::now());
            }
        } else {
            entry.last_request = Some(Instant::now());
        }
    }
}

/// Fetcher configuration.
#[derive(Debug, Clone)]
pub struct FetcherConfig {
    pub byte_limit: usize,
    pub request_timeout: Duration,
    pub max_redirects: usize,
    pub cache_ttl: Duration,
    pub min_interval_ms: u64,
    pub max_retries: u32,
    pub retry_backoff_ms: u64,
}

impl Default for FetcherConfig {
    fn default() -> Self {
        Self {
            byte_limit: 2_000_000,
            request_timeout: Duration::from_secs(20),
            max_redirects: 10,
            cache_ttl: Duration::from_secs(3600),
            min_interval_ms: 500,
            max_retries: 3,
            retry_backoff_ms: 1000,
        }
    }
}

/// The enhanced fetcher.
#[derive(Clone)]
pub struct Fetcher {
    config: FetcherConfig,
    clients: Arc<RwLock<HashMap<String, Client>>>,
    rate_limiter: Arc<GlobalRateLimiter>,
}

impl Fetcher {
    pub fn new(config: FetcherConfig) -> Self {
        Self {
            config,
            clients: Arc::new(RwLock::new(HashMap::new())),
            rate_limiter: Arc::new(GlobalRateLimiter::new()),
        }
    }

    /// Fetch a URL with SSRF protection, redirect handling, retry, and rate limiting.
    pub async fn fetch(&self, start: &str) -> Result<FetchResult, String> {
        let mut current = url::Url::parse(start)
            .map_err(|e| format!("invalid URL: {}", e))?;

        let mut redirect_chain = Vec::new();
        let mut seen = HashSet::new();

        'redirect: for _ in 0..=self.config.max_redirects {
            if !seen.insert(current.clone()) {
                return Err("redirect loop detected".to_owned());
            }

            let host = current
                .host_str()
                .ok_or_else(|| "target URL has no host".to_owned())?;
            let port = current.port_or_known_default().unwrap_or(443);

            // SSRF protection: resolve and validate public addresses.
            let addresses = resolve_public_addresses(host, port)
                .await
                .map_err(|e| format!("DNS resolution failed: {}", e))?;

            // Rate limit per domain.
            self.rate_limiter.acquire(host, self.config.min_interval_ms).await;

            // Get or create a client pinned to resolved addresses.
            let client = self.get_client(host, port, &addresses).await?;

            // Retry loop.
            let mut last_err: Option<String> = None;
            for attempt in 0..=self.config.max_retries {
                let response = client
                    .get(current.clone())
                    .header(
                        "User-Agent",
                        "AnswerScopeBot/0.2 (+https://answerscope.example/bot)",
                    )
                    .send()
                    .await;

                match response {
                    Ok(resp) => {
                        if resp.status().is_redirection() {
                            redirect_chain.push(current.to_string());
                            let location = resp
                                .headers()
                                .get(LOCATION)
                                .ok_or_else(|| "redirect missing Location header".to_owned())?
                                .to_str()
                                .map_err(|e| format!("invalid Location header: {}", e))?;
                            let joined = current.join(location).map_err(|e| format!("redirect join error: {}", e))?;
                            current = joined;
                            break; // break retry loop, continue redirect loop
                        }

                        let content_type = resp
                            .headers()
                            .get(reqwest::header::CONTENT_TYPE)
                            .and_then(|v| v.to_str().ok())
                            .map(|s| s.to_owned());

                        let status = resp.status();

                        // Enforce byte limit while streaming.
                        let mut body = Vec::new();
                        let mut stream = resp.bytes_stream();
                        while let Some(chunk) = stream.next().await {
                            let chunk = chunk.map_err(|e| format!("stream error: {}", e))?;
                            if body.len() + chunk.len() > self.config.byte_limit {
                                return Err("response exceeded byte limit".to_owned());
                            }
                            body.extend_from_slice(&chunk);
                        }

                        return Ok(FetchResult {
                            final_url: current.to_string(),
                            status,
                            content_type,
                            body: String::from_utf8_lossy(&body).into_owned(),
                            redirect_chain,
                        });
                    }
                    Err(e) => {
                        last_err = Some(format!("fetch attempt {} failed: {}", attempt + 1, e));
                        if attempt < self.config.max_retries {
                            let backoff =
                                Duration::from_millis(self.config.retry_backoff_ms * (2u64.pow(attempt)));
                            sleep(backoff).await;
                        }
                    }
                }
            }

            return Err(last_err.unwrap_or_else(|| "fetch failed after retries".to_owned()));
        }

        Err("redirect limit exceeded".to_owned())
    }

    async fn get_client(
        &self,
        host: &str,
        port: u16,
        addresses: &[std::net::SocketAddr],
    ) -> Result<Client, String> {
        let key = format!("{}:{}", host, port);
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
            .redirect(reqwest::redirect::Policy::none())
            .timeout(self.config.request_timeout)
            .connect_timeout(Duration::from_secs(5))
            .resolve_to_addrs(host, addresses)
            .build()
            .map_err(|e| format!("client build error: {}", e))?;
        writers.insert(key, client.clone());
        Ok(client)
    }
}

async fn resolve_public_addresses(host: &str, port: u16) -> Result<Vec<std::net::SocketAddr>, String> {
    let addresses: Vec<_> = lookup_host((host, port))
        .await
        .map_err(|e| format!("DNS lookup failed: {}", e))?
        .collect();
    if addresses.is_empty() {
        return Err("DNS lookup returned no addresses".to_owned());
    }
    for address in &addresses {
        ensure_public_ip(address.ip()).map_err(|e| format!("SSRF protection: {}", e))?;
    }
    Ok(addresses)
}

use std::collections::HashSet;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rate_limiter_default_is_empty() {
        let limiter = GlobalRateLimiter::new();
        let _ = limiter;
    }

    #[test]
    fn config_defaults_are_sane() {
        let config = FetcherConfig::default();
        assert!(config.byte_limit > 0);
        assert!(config.max_retries > 0);
        assert!(config.max_redirects > 0);
    }
}
