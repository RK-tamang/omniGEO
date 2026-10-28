//! LLM Mentions adapter for DataForSEO.
//!
//! Uses the DataForSEO LLM Mentions API endpoint. This endpoint has NOT been
//! live-verified; the adapter returns ProviderError::NotConfigured until
//! credentials and endpoint verification are in place.

use answerscope_ai_visibility::{
    AiObservationProvider, NormalizedObservation, ObservationRequest,
    ProviderCapabilities, ProviderError,
};
use async_trait::async_trait;
use serde_json::{Value, json};
use std::sync::Arc;

use crate::dataforseo::DataForSeoShared;

pub struct LlmMentions {
    shared: DataForSeoShared,
}

impl LlmMentions {
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
        "/v3/business_data/app_data/reviews/live"
    }
}

#[async_trait]
impl AiObservationProvider for LlmMentions {
    fn provider_id(&self) -> &'static str {
        "dataforseo_llm_mentions"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            surfaces: vec!["llm_mentions".into()],
            countries: vec!["US".into(), "GB".into(), "CA".into(), "AU".into()],
            languages: vec!["en".into()],
            max_prompt_chars: 500,
            is_consumer_search_observation: true,
        }
    }

    fn estimate_cost(&self, request: &ObservationRequest) -> Result<i64, ProviderError> {
        if request.prompt.trim().is_empty() || request.prompt.chars().count() > 500 {
            return Err(ProviderError::InvalidResponse(
                "prompt must contain 1-500 characters".into(),
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
                    "location is not enabled for LLM Mentions".into(),
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
            .get("mention_rate")
            .or_else(|| result.get("mentions"))
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned();

        let cost = super::extract_cost_microusd(&payload);
        let mut limitations = vec![
            "LLM Mentions data is a third-party aggregate estimate from DataForSEO; it is not an OmniGEO measured rate.".to_owned(),
            "Do not combine incompatible metric denominators across providers.".to_owned(),
        ];

        Ok(NormalizedObservation {
            provider_id: self.provider_id().into(),
            engine: "LLM Mentions".into(),
            surface: "llm_mentions".into(),
            answer_text,
            citations: vec![],
            raw_response: payload,
            provider_cost_microusd: cost,
            limitations,
        })
    }
}
