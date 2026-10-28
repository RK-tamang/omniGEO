//! DataForSEO AI Search Intelligence adapters.
//!
//! This module extends the existing `DataForSeoChatGptSearch` adapter with
//! additional DataForSEO API families: Gemini LLM Scraper, Google AI Overviews,
//! Google AI Mode, LLM Mentions, and AI Keyword Data.
//!
//! All adapters implement `answerscope_ai_visibility::AiObservationProvider` and
//! are registered in the API's `provider_for` function. Adapters whose endpoint
//! has not been live-verified return `ProviderError::NotConfigured` until
//! credentials and endpoint verification are in place.

pub mod client;
pub mod config;
pub mod errors;
pub mod cost;
pub mod normalizer;
pub mod persistence;

pub mod llm_scraper;
pub mod serp;
pub mod intelligence;

use answerscope_ai_visibility::{
    AiObservationProvider, Citation, NormalizedObservation, ObservationRequest,
    ProviderCapabilities, ProviderError,
};
use async_trait::async_trait;
use serde_json::{Value, json};
use std::sync::Arc;

use crate::dataforseo::client::DataForSeoClient;
use crate::dataforseo::config::DataForSeoConfig;
use crate::dataforseo::errors::DataForSeoError;
use crate::dataforseo::cost::DataForSeoCostTracker;

/// Shared DataForSEO provider state. Each adapter holds an Arc to this so
/// credentials, HTTP client, and cost tracking are shared across adapter types.
#[derive(Clone)]
pub struct DataForSeoShared {
    pub client: Arc<DataForSeoClient>,
    pub config: Arc<DataForSeoConfig>,
    pub cost_tracker: Arc<DataForSeoCostTracker>,
}

/// Map a DataForSEO API error response into a ProviderError.
pub fn dataforseo_error(status: u16, body: &str) -> ProviderError {
    if status == 401 || status == 403 {
        return ProviderError::NotConfigured(format!("DataForSEO authentication failed (HTTP {status})"));
    }
    if status == 429 {
        return ProviderError::QuotaExceeded;
    }
    ProviderError::Request(format!("DataForSEO HTTP {status}: {body}"))
}

/// Extract the provider-reported cost from a DataForSEO task payload.
pub fn extract_cost_microusd(payload: &Value) -> Option<i64> {
    payload
        .get("cost")
        .and_then(Value::as_f64)
        .or_else(|| {
            payload
                .get("tasks")
                .and_then(Value::as_array)
                .and_then(|v| v.first())
                .and_then(|t| t.get("cost"))
                .and_then(Value::as_f64)
        })
        .map(|v| (v * 1_000_000.0).round() as i64)
}

/// Normalize a citation URL into a domain.
pub fn citation_domain(url: &str) -> Option<String> {
    url::Url::parse(url).ok()?.host_str().map(str::to_ascii_lowercase)
}

/// Build a normalized citation from a DataForSEO result item.
pub fn citation_from_item(item: &Value) -> Option<Citation> {
    let url = item.get("url").and_then(Value::as_str)?;
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return None;
    }
    Some(Citation {
        url: url.to_owned(),
        title: item.get("title").and_then(Value::as_str).map(str::to_owned),
        source_domain: item
            .get("domain")
            .and_then(Value::as_str)
            .map(str::to_ascii_lowercase)
            .or_else(|| citation_domain(url)),
    })
}

/// Deduplicate citations by URL.
pub fn dedup_citations(citations: Vec<Citation>) -> Vec<Citation> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for c in citations {
        if seen.insert(c.url.clone()) {
            out.push(c);
        }
    }
    out
}

#[async_trait]
impl AiObservationProvider for DataForSeoShared {
    fn provider_id(&self) -> &'static str {
        "dataforseo_shared"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            surfaces: vec![],
            countries: vec![],
            languages: vec![],
            max_prompt_chars: 2000,
            is_consumer_search_observation: true,
        }
    }

    fn estimate_cost(&self, _request: &ObservationRequest) -> Result<i64, ProviderError> {
        Err(ProviderError::NotConfigured(
            "use a specific adapter instead of the shared handle".into(),
        ))
    }

    async fn execute(
        &self,
        _request: ObservationRequest,
    ) -> Result<NormalizedObservation, ProviderError> {
        Err(ProviderError::NotConfigured(
            "use a specific adapter instead of the shared handle".into(),
        ))
    }
}
