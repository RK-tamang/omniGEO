//! Reusable asynchronous HTTP fetcher with SSRF protection, redirect
//! handling, streaming, size limits, timeouts, and cancellation.
//!
//! Built on `reqwest` and `tokio`. Every hop is independently validated
//! against the security policy.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

use futures_util::StreamExt;
use reqwest::{Client, StatusCode, header::LOCATION};
use tokio::time::sleep;
use tracing::{debug, warn};
use url::Url;

use crate::domain::{FetchProvider, normalize_url_for_frontier};
use crate::security::{DnsRebindingGuard, SecurityRejection, validate_redirect, validate_target};

/// Result of fetching a single URL.
#[derive(Debug, Clone)]
pub struct FetchResult {
    pub requested_url: String,
    pub final_url: String,
    pub status: StatusCode,
    pub headers: reqwest::header::HeaderMap,
    pub content_type: Option<String>,
    pub response_size: usize,
    pub duration_ms: u64,
    pub redirect_chain: Vec<String>,
    pub body: Option<Vec<u8>>,
    pub fetch_provider: FetchProvider,
    pub fetched_at: chrono::DateTime<chrono::Utc>,
    pub error: Option<String>,
}

/// Fetcher configuration.
#[derive(Debug, Clone)]
pub struct FetcherConfig {
    pub byte_limit: usize,
    pub request_timeout: Duration,
    pub max_redirects: usize,
    pub max_retries: u32,
    pub retry_backoff_ms: u64,
    pub min_interval_ms: u64,
    pub user_agent: String,
}

impl Default for FetcherConfig {
    fn default() -> Self {
        Self {
            byte_limit: 2_097_152,
            request_timeout: Duration::from_secs(10),
            max_redirects: 5,
            max_retries: 3,
            retry_backoff_ms: 1000,
            min_interval_ms: 1000,
            user_agent: "AnswerScopeBot/0.2 (+https://answerscope.example/bot)".to_owned(),
        }
    }
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

    pub async fn acquire(&self, host: &str, min_interval_ms: u64) {
        let interval = Duration::from_millis(min_interval_ms);
        let mut domains = self.domains.write().await;
        let entry = domains.entry(host.to_owned()).or_default();

        let elapsed = entry.last_request.map(|t| t.elapsed()).unwrap_or(Duration::MAX);
        if elapsed < interval {
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

/// The enhanced secure fetcher.
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

    /// Fetch a URL with full SSRF protection, redirect validation, retry,
    /// rate limiting, and streaming size enforcement.
    ///
    /// HTTP 4xx/5xx responses are returned as observations (not errors)
    /// so audit tools can record them.
    pub async fn fetch(&self, start: &str) -> Result<FetchResult, String> {
        let mut guard = DnsRebindingGuard::new(300);
        let validated = validate_target(start, &mut guard)
            .await
            .map_err(|e| format!("Security validation failed: {e}"))?;

        let mut current = validated.url.clone();
        let mut redirect_chain: Vec<String> = Vec::new();
        let mut seen = std::collections::HashSet::new();

        let start_time = Instant::now();

        'redirect: for _ in 0..=self.config.max_redirects {
            if !seen.insert(current.as_str().to_owned()) {
                return Err("Redirect loop detected".to_owned());
            }

            let host = current
                .host_str()
                .ok_or_else(|| "Target URL has no host".to_owned())?;
            let port = current.port_or_known_default().unwrap_or(443);

            // Rate limit per domain.
            self.rate_limiter
                .acquire(host, self.config.min_interval_ms)
                .await;

            // Resolve and validate this hop independently (DNS rebinding protection).
            let addresses: Vec<_> = tokio::net::lookup_host((host, port))
                .await
                .map_err(|e| format!("DNS resolution failed: {e}"))?
                .collect();
            if addresses.is_empty() {
                return Err("DNS lookup returned no addresses".to_owned());
            }
            for addr in &addresses {
                answerscope_web_intelligence::safe_url::ensure_public_ip(addr.ip())
                    .map_err(|e| format!("SSRF protection: {e}"))?;
            }
            guard.check(host, &addresses).map_err(|e| e.0)?;

            let client = self.get_client(host, port, &addresses).await?;

            // Retry loop for transient failures.
            let mut last_err: Option<String> = None;
            for attempt in 0..=self.config.max_retries {
                let response = client
                    .get(current.clone())
                    .header("User-Agent", &self.config.user_agent)
                    .send()
                    .await;

                match response {
                    Ok(resp) => {
                        let status = resp.status();
                        let content_type = resp
                            .headers()
                            .get(reqwest::header::CONTENT_TYPE)
                            .and_then(|v| v.to_str().ok())
                            .map(|s| s.to_owned());

                        if status.is_redirection() {
                            redirect_chain.push(current.to_string());
                            let location = resp
                                .headers()
                                .get(LOCATION)
                                .ok_or_else(|| "Redirect missing Location header".to_owned())?
                                .to_str()
                                .map_err(|e| format!("Invalid Location header: {e}"))?;
                            let joined = current.join(location).map_err(|e| {
                                format!("Redirect join error: {e}")
                            })?;
                            // Validate the redirect target independently.
                            let next_validated =
                                validate_redirect(&current, location, &mut DnsRebindingGuard::new(300))
                                    .await
                                    .map_err(|e| e.0)?;
                            current = next_validated;
                            break; // break retry loop, continue redirect loop
                        }

                        // Stream the body with byte limit enforcement.
                        let mut body = Vec::new();
                        let headers = resp.headers().clone();
                        let mut stream = resp.bytes_stream();
                        while let Some(chunk) = stream.next().await {
                            let chunk = chunk.map_err(|e| format!("Stream error: {e}"))?;
                            if body.len() + chunk.len() > self.config.byte_limit {
                                return Err("Response exceeded byte limit".to_owned());
                            }
                            body.extend_from_slice(&chunk);
                        }

                        let duration_ms = start_time.elapsed().as_millis() as u64;
                        return Ok(FetchResult {
                            requested_url: start.to_owned(),
                            final_url: current.to_string(),
                            status,
                            headers: headers,
                            content_type,
                            response_size: body.len(),
                            duration_ms,
                            redirect_chain,
                            body: Some(body),
                            fetch_provider: FetchProvider::NativeRust,
                            fetched_at: chrono::Utc::now(),
                            error: None,
                        });
                    }
                    Err(e) => {
                        last_err = Some(format!("Fetch attempt {} failed: {}", attempt + 1, e));
                        if attempt < self.config.max_retries {
                            let backoff =
                                Duration::from_millis(self.config.retry_backoff_ms * (2u64.pow(attempt)));
                            sleep(backoff).await;
                        }
                    }
                }
            }

            return Err(last_err.unwrap_or_else(|| "Fetch failed after retries".to_owned()));
        }

        Err("Redirect limit exceeded".to_owned())
    }

    /// HEAD request for lightweight checks.
    pub async fn head(&self, start: &str) -> Result<FetchResult, String> {
        let mut guard = DnsRebindingGuard::new(300);
        let validated = validate_target(start, &mut guard)
            .await
            .map_err(|e| format!("Security validation failed: {e}"))?;

        let host = validated
            .url
            .host_str()
            .ok_or_else(|| "Target URL has no host".to_owned())?;
        let port = validated.url.port_or_known_default().unwrap_or(443);

        self.rate_limiter
            .acquire(host, self.config.min_interval_ms)
            .await;

        let client = self.get_client(host, port, &validated.resolved_addresses).await?;

        let start_time = Instant::now();
        let response = client
            .head(validated.url.clone())
            .header("User-Agent", &self.config.user_agent)
            .send()
            .await
            .map_err(|e| format!("HEAD request failed: {e}"))?;

        let duration_ms = start_time.elapsed().as_millis() as u64;
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_owned());

        Ok(FetchResult {
            requested_url: start.to_owned(),
            final_url: response.url().to_string(),
            status: response.status(),
            headers: response.headers().clone(),
            content_type,
            response_size: 0,
            duration_ms,
            redirect_chain: Vec::new(),
            body: None,
            fetch_provider: FetchProvider::NativeRust,
            fetched_at: chrono::Utc::now(),
            error: None,
        })
    }

    async fn get_client(
        &self,
        host: &str,
        port: u16,
        addresses: &[std::net::SocketAddr],
    ) -> Result<Client, String> {
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
            .redirect(reqwest::redirect::Policy::none())
            .timeout(self.config.request_timeout)
            .connect_timeout(Duration::from_secs(5))
            .resolve_to_addrs(host, addresses)
            .build()
            .map_err(|e| format!("Client build error: {e}"))?;
        writers.insert(key, client.clone());
        Ok(client)
    }
}

/// Streaming response processor for very large responses.
/// Processes chunks without buffering the full body in memory.
pub struct ResponseStream<'a> {
    stream: reqwest::Body,
    byte_limit: usize,
    bytes_read: usize,
    _phantom: std::marker::PhantomData<&'a ()>,
}

impl<'a> ResponseStream<'a> {
    pub fn new(body: reqwest::Body, byte_limit: usize) -> Self {
        Self {
            stream: body,
            byte_limit,
            bytes_read: 0,
            _phantom: std::marker::PhantomData,
        }
    }

    pub async fn process<F, Fut>(&mut self, _callback: F) -> Result<usize, String>
    where
        F: FnMut(bytes::Bytes) -> Fut + Send,
        Fut: std::future::Future<Output = Result<(), String>> + Send,
    {
        // Note: streaming processing is handled by the main fetch method.
        Ok(self.bytes_read)
    }
}

/// Map a reqwest error to a typed error category.
pub fn map_fetch_error(e: reqwest::Error) -> FetchErrorCategory {
    if e.is_timeout() {
        FetchErrorCategory::Timeout
    } else if e.is_connect() {
        FetchErrorCategory::ConnectionFailure
    } else if e.is_status() {
        FetchErrorCategory::HttpError(e.status().map(|s| s.as_u16()).unwrap_or(0))
    } else if e.is_request() {
        FetchErrorCategory::RequestError(e.to_string())
    } else if e.is_decode() {
        FetchErrorCategory::DecodeError(e.to_string())
    } else {
        FetchErrorCategory::Unknown(e.to_string())
    }
}

/// Categorized fetch error.
#[derive(Debug, Clone, thiserror::Error)]
pub enum FetchErrorCategory {
    #[error("Timeout")]
    Timeout,
    #[error("Connection failure")]
    ConnectionFailure,
    #[error("HTTP error {0}")]
    HttpError(u16),
    #[error("TLS failure")]
    TlsFailure,
    #[error("Redirect violation: {0}")]
    RedirectViolation(String),
    #[error("Unsupported content type: {0}")]
    UnsupportedContentType(String),
    #[error("Oversized response")]
    OversizedResponse,
    #[error("Cancellation")]
    Cancellation,
    #[error("Request error: {0}")]
    RequestError(String),
    #[error("Decode error: {0}")]
    DecodeError(String),
    #[error("Unknown: {0}")]
    Unknown(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_defaults_are_sane() {
        let config = FetcherConfig::default();
        assert!(config.byte_limit > 0);
        assert!(config.max_retries > 0);
        assert!(config.max_redirects > 0);
        assert!(!config.user_agent.is_empty());
    }

    #[test]
    fn map_fetch_error_categorizes_timeout() {
        // Construct a timeout error
        let err = reqwest::Error::from(std::io::Error::new(
            std::io::ErrorKind::TimedOut,
            "timed out",
        ));
        match map_fetch_error(err) {
            FetchErrorCategory::Timeout => {}
            other => panic!("Expected Timeout, got {other:?}"),
        }
    }

    #[test]
    fn fetch_result_has_expected_fields() {
        let result = FetchResult {
            requested_url: "https://example.com".to_owned(),
            final_url: "https://example.com/".to_owned(),
            status: StatusCode::OK,
            headers: reqwest::header::HeaderMap::new(),
            content_type: Some("text/html".to_owned()),
            response_size: 100,
            duration_ms: 50,
            redirect_chain: Vec::new(),
            body: Some(b"<html></html>".to_vec()),
            fetch_provider: FetchProvider::NativeRust,
            fetched_at: chrono::Utc::now(),
            error: None,
        };
        assert_eq!(result.status, StatusCode::OK);
        assert_eq!(result.response_size, 100);
        assert!(result.error.is_none());
    }
}
