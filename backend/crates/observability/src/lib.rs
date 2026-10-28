//! Structured logging, correlation IDs and process lifecycle signals.

use std::time::Instant;

use anyhow::{Context, Result};
use axum::{
    extract::{FromRequestParts, Request},
    http::{HeaderName, HeaderValue, StatusCode, request::Parts},
    middleware::Next,
    response::Response,
};
use answerscope_config::LogFormat;
use tracing::{Instrument, info, info_span};
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

/// Header used to correlate requests across services.
pub const REQUEST_ID_HEADER: &str = "x-request-id";

/// Validated request correlation ID.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RequestId(String);

impl RequestId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn generate() -> Self {
        Self(format!("req-{}", Uuid::new_v4().simple()))
    }
}

impl std::fmt::Display for RequestId {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl<S> FromRequestParts<S> for RequestId
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<RequestId>()
            .cloned()
            .ok_or((
                StatusCode::INTERNAL_SERVER_ERROR,
                "request correlation middleware is not installed",
            ))
    }
}

/// Initialize JSON or pretty structured logging.
///
/// `RUST_LOG` controls filtering. The default filter intentionally targets only
/// AnswerScope crates and `tower_http`, avoiding noisy or sensitive debug output.
pub fn init_tracing(service: &str, format: LogFormat) -> Result<()> {
    let default_filter = format!("{service}=info,tower_http=info");
    let filter = EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new(default_filter.clone()))
        .with_context(|| format!("invalid RUST_LOG filter; default would be {default_filter}"))?;

    let registry = tracing_subscriber::registry().with(filter);
    match format {
        LogFormat::Json => registry
            .with(
                tracing_subscriber::fmt::layer()
                    .json()
                    .flatten_event(true)
                    .with_current_span(true)
                    .with_span_list(false)
                    .with_target(true),
            )
            .try_init()
            .context("failed to initialize JSON tracing subscriber")?,
        LogFormat::Pretty => registry
            .with(
                tracing_subscriber::fmt::layer()
                    .compact()
                    .with_target(true),
            )
            .try_init()
            .context("failed to initialize tracing subscriber")?,
    }
    Ok(())
}

/// Correlation, access-logging and request-ID propagation middleware.
///
/// Incoming IDs are accepted only when short and made of safe characters. All
/// other requests receive a generated ID. The ID is stored in request
/// extensions, used in the structured request span, and echoed in the response.
pub async fn request_context(mut request: Request, next: Next) -> Response {
    let request_id = request
        .headers()
        .get(REQUEST_ID_HEADER)
        .and_then(|value| value.to_str().ok())
        .and_then(sanitize_request_id)
        .map(RequestId::new)
        .unwrap_or_else(RequestId::generate);
    request.extensions_mut().insert(request_id.clone());

    let method = request.method().clone();
    let path = request.uri().path().to_owned();
    let started = Instant::now();
    let span = info_span!(
        "http_request",
        request_id = %request_id,
        method = %method,
        path = %path
    );

    let response = answerscope_error::with_request_id(request_id.as_str().to_owned(), next.run(request))
        .instrument(span.clone())
        .await;

    let status = response.status().as_u16();
    let latency_ms = started.elapsed().as_millis() as u64;
    span.in_scope(|| {
        info!(
            status,
            latency_ms,
            "request completed"
        );
    });

    let mut response = response;
    if let Ok(value) = HeaderValue::from_str(request_id.as_str()) {
        response.headers_mut().insert(
            HeaderName::from_static(REQUEST_ID_HEADER),
            value,
        );
    }
    response
}

fn sanitize_request_id(value: &str) -> Option<String> {
    let value = value.trim();
    let valid_length = (8..=128).contains(&value.len());
    let valid_chars = value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | ':'));
    (valid_length && valid_chars).then(|| value.to_owned())
}

/// Wait for SIGINT/SIGTERM (or Ctrl+C on Windows).
pub async fn shutdown_signal() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};
        let mut terminate = match signal(SignalKind::terminate()) {
            Ok(signal) => signal,
            Err(error) => {
                tracing::error!(%error, "failed to install SIGTERM handler");
                let _ = tokio::signal::ctrl_c().await;
                return;
            }
        };
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {}
            _ = terminate.recv() => {}
        }
    }

    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_safe_correlation_ids() {
        assert_eq!(
            sanitize_request_id("req-12345678"),
            Some("req-12345678".to_owned())
        );
        assert_eq!(
            sanitize_request_id("trace:abc.def_123"),
            Some("trace:abc.def_123".to_owned())
        );
    }

    #[test]
    fn rejects_short_or_unsafe_correlation_ids() {
        assert_eq!(sanitize_request_id("short"), None);
        assert_eq!(sanitize_request_id("bad id with spaces"), None);
        assert_eq!(sanitize_request_id("bad\nheader"), None);
        assert_eq!(sanitize_request_id(&"x".repeat(129)), None);
    }

    #[test]
    fn generated_ids_are_prefixed_and_unique() {
        let first = RequestId::generate();
        let second = RequestId::generate();
        assert!(first.as_str().starts_with("req-"));
        assert_ne!(first, second);
        assert!(sanitize_request_id(first.as_str()).is_some());
    }
}
