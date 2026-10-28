//! Gemini LLM Scraper adapter for DataForSEO.
//!
//! Uses the DataForSEO `ai_optimization/gemini/llm_scraper/live/advanced` endpoint.
//! This endpoint has NOT been live-verified; the adapter returns
//! `ProviderError::NotConfigured` until credentials and endpoint verification
//! are in place.

use answerscope_ai_visibility::{
    AiObservationProvider, Citation, NormalizedObservation, ObservationRequest,
    ProviderCapabilities, ProviderError,
};
use async_trait::async_trait;
use serde_json::{Value, json};
use std::sync::Arc;

use crate::dataforseo::{citation_from_item, dedup_citations, DataForSeoShared};

pub struct GeminiLlmScraper {
    shared: DataForSeoShared,
}

impl GeminiLlmScraper {
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
        "/v3/ai_optimization/gemini/llm_scraper/live/advanced"
    }
}

#[async_trait]
impl AiObservationProvider for GeminiLlmScraper {
    fn provider_id(&self) -> &'static str {
        "dataforseo_gemini_search"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            surfaces: vec!["gemini_search".into()],
            countries: vec!["US".into(), "GB".into(), "CA".into(), "AU".into()],
            languages: vec!["en".into()],
            max_prompt_chars: 2000,
            is_consumer_search_observation: true,
        }
    }

    fn estimate_cost(&self, request: &ObservationRequest) -> Result<i64, ProviderError> {
        if request.prompt.trim().is_empty() || request.prompt.chars().count() > 2000 {
            return Err(ProviderError::InvalidResponse(
                "prompt must contain 1-2000 characters".into(),
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
                    "location is not enabled for Gemini LLM Scraper".into(),
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

        let body = json!([{
            "keyword": request.prompt,
            "location_name": location_name,
            "language_code": language_code,
            "force_web_search": true,
            "tag": tag
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
            .get("markdown")
            .or_else(|| result.get("content"))
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned();

        let mut citations = Vec::new();
        for key in ["sources", "search_results"] {
            if let Some(items) = result.get(key).and_then(Value::as_array) {
                for item in items {
                    if let Some(c) = super::citation_from_item(item) {
                        citations.push(c);
                    }
                }
            }
        }
        citations = dedup_citations(citations);

        let cost = super::extract_cost_microusd(&payload);
        let mut limitations = vec![
            "A sampled Gemini LLM Scraper result is an observation for this exact prompt, location, language, and collection time; it does not estimate all user impressions.".to_owned(),
        ];
        if citations.is_empty() {
            limitations.push("The provider returned no citation URLs for this observation.".to_owned());
        }

        Ok(NormalizedObservation {
            provider_id: self.provider_id().into(),
            engine: "Gemini".into(),
            surface: "gemini_search".into(),
            answer_text,
            citations,
            raw_response: payload,
            provider_cost_microusd: cost,
            limitations,
        })
    }
}
