//! Google AI Overviews adapter via DataForSEO SERP API.
//!
//! Uses `serp/google/organic/live/advanced` with `load_async_ai_overview`.
//! NOTE: `load_async_ai_overview` is a paid option that multiplies cost.
//! This adapter does NOT enable it by default; callers must explicitly approve.

use answerscope_ai_visibility::{
    AiObservationProvider, Citation, NormalizedObservation, ObservationRequest,
    ProviderCapabilities, ProviderError,
};
use async_trait::async_trait;
use serde_json::{Value, json};
use std::sync::Arc;

use crate::dataforseo::{citation_domain, citation_from_item, dedup_citations, DataForSeoShared};

pub struct GoogleAiOverview {
    shared: DataForSeoShared,
}

impl GoogleAiOverview {
    pub fn from_env() -> Result<Self, ProviderError> {
        let config = super::config::DataForSeoConfig::from_env();
        if !config.is_configured() {
            return Err(ProviderError::NotConfigured(
                "DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are required".into(),
            ));
        }
        let shared = config.shared();
        Ok(Self { shared })
    }

    fn endpoint() -> &'static str {
        "/v3/serp/google/organic/live/advanced"
    }
}

#[async_trait]
impl AiObservationProvider for GoogleAiOverview {
    fn provider_id(&self) -> &'static str {
        "dataforseo_google_ai_overview"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            surfaces: vec!["google_ai_overview".into()],
            countries: vec!["US".into(), "GB".into(), "CA".into(), "AU".into()],
            languages: vec!["en".into()],
            max_prompt_chars: 700,
            is_consumer_search_observation: true,
        }
    }

    fn estimate_cost(&self, request: &ObservationRequest) -> Result<i64, ProviderError> {
        if request.prompt.trim().is_empty() || request.prompt.chars().count() > 700 {
            return Err(ProviderError::InvalidResponse(
                "prompt must contain 1-700 characters".into(),
            ));
        }
        self.shared
            .config
            .estimated_cost_micro_usd
            .ok_or_else(|| {
                ProviderError::NotConfigured(
                    "DATAFORSEO_ESTIMATED_COST_MICRO_USD must be set".into(),
                )
            })
    }

    async fn execute(
        &self,
        request: ObservationRequest,
    ) -> Result<NormalizedObservation, ProviderError> {
        let country = request.country.to_ascii_uppercase();
        let language = request.language.to_ascii_lowercase();
        let (location_name, language_code) = match country.as_str() {
            "US" => ("United States", "en"),
            "GB" | "UK" => ("United Kingdom", "en"),
            "CA" => ("Canada", "en"),
            "AU" => ("Australia", "en"),
            _ => {
                return Err(ProviderError::InvalidResponse(
                    "location is not enabled for Google AI Overviews".into(),
                ));
            }
        };
        if !language.eq_ignore_ascii_case(language_code) {
            return Err(ProviderError::InvalidResponse(
                "language is not supported for the selected country".into(),
            ));
        }

        let tag = request
            .parameters
            .get("tag")
            .and_then(Value::as_str)
            .filter(|v| v.len() <= 255)
            .unwrap_or("answerscope");

        // NOTE: We do NOT set load_async_ai_overview=true by default because it
        // multiplies cost. Callers must explicitly approve async AI Overview.
        let body = json!([{
            "keyword": request.prompt,
            "location_name": location_name,
            "language_code": language_code,
            "tag": tag,
            "depth": 10
        }]);

        let response = self
            .shared
            .client
            .post_json(Self::endpoint(), &body)
            .await
            .map_err(|e| ProviderError::Request(e.to_string()))?;

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(ProviderError::QuotaExceeded);
        }
        let status = response.status();
        let payload: Value = response
            .json()
            .await
            .map_err(|e| ProviderError::InvalidResponse(e.to_string()))?;
        if !status.is_success() {
            return Err(ProviderError::Request(format!("HTTP {}", status.as_u16())));
        }

        let task = payload
            .get("tasks")
            .and_then(Value::as_array)
            .and_then(|v| v.first())
            .ok_or_else(|| ProviderError::InvalidResponse("response has no task".into()))?;
        let task_code = task
            .get("status_code")
            .and_then(Value::as_i64)
            .unwrap_or_default();
        if task_code != 20000 {
            return Err(ProviderError::Request(
                task.get("status_message")
                    .and_then(Value::as_str)
                    .unwrap_or("provider task failed")
                    .to_owned(),
            ));
        }
        let result = task
            .get("result")
            .and_then(Value::as_array)
            .and_then(|v| v.first())
            .ok_or_else(|| ProviderError::InvalidResponse("task has no result".into()))?;

        let answer_text = result
            .get("ai_overview")
            .and_then(Value::as_str)
            .or_else(|| result.get("markdown").and_then(Value::as_str))
            .unwrap_or_default()
            .to_owned();

        let ai_overview_present = result
            .get("ai_overview_is_present")
            .and_then(Value::as_bool)
            .unwrap_or(!answer_text.is_empty());

        let mut citations = Vec::new();
        if let Some(items) = result.get("items").and_then(Value::as_array) {
            for item in items {
                if let Some(url) = item
                    .get("url")
                    .and_then(Value::as_str)
                    .filter(|u| u.starts_with("http://") || u.starts_with("https://"))
                {
                    if citations.iter().any(|c: &Citation| c.url == url) {
                        continue;
                    }
                    citations.push(Citation {
                        url: url.to_owned(),
                        title: item.get("title").and_then(Value::as_str).map(str::to_owned),
                        source_domain: item
                            .get("domain")
                            .and_then(Value::as_str)
                            .map(str::to_ascii_lowercase)
                            .or_else(|| super::citation_domain(url)),
                    });
                }
            }
        }
        citations = dedup_citations(citations);

        let cost = super::extract_cost_microusd(&payload);
        let mut limitations = vec![
            "A sampled Google AI Overview result is an observation for this exact prompt, location, language, and collection time; it does not estimate all user impressions.".to_owned(),
        ];
        if !ai_overview_present {
            limitations.push("No AI Overview was present for this query.".to_owned());
        }
        if citations.is_empty() {
            limitations.push("The provider returned no citation URLs for this observation.".to_owned());
        }

        Ok(NormalizedObservation {
            provider_id: self.provider_id().into(),
            engine: "Google AI Overview".into(),
            surface: "google_ai_overview".into(),
            answer_text,
            citations,
            raw_response: payload,
            provider_cost_microusd: cost,
            limitations,
        })
    }
}
