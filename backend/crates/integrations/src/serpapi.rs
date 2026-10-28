//! SerpApi provider adapter for Google AI Mode and AI Overview results.
//!
//! Uses the documented SerpApi Google search endpoint. Results from AI Mode
//! and AI Overview surfaces are normalized into the shared
//! `NormalizedObservation` schema. Each provider's original metadata is
//! preserved in `raw_response`. Missing citation data is never reported as
//! zero citations.

use answerscope_ai_visibility::{
    AiObservationProvider, Citation, NormalizedObservation, ObservationRequest,
    ProviderCapabilities, ProviderError,
};
use async_trait::async_trait;
use serde_json::Value;

pub struct SerpApi {
    client: reqwest::Client,
    api_key: String,
    estimate_microusd: i64,
}

impl SerpApi {
    pub fn from_env() -> Result<Self, ProviderError> {
        let api_key = std::env::var("SERPAPI_API_KEY")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| ProviderError::NotConfigured("SERPAPI_API_KEY".into()))?;
        let estimate_microusd = std::env::var("SERPAPI_ESTIMATED_COST_MICRO_USD").ok()
            .and_then(|v| v.parse::<i64>().ok()).filter(|v| *v > 0)
            .ok_or_else(|| ProviderError::NotConfigured("SERPAPI_ESTIMATED_COST_MICRO_USD must be set to the configured conservative per-request price".into()))?;
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(125))
            .user_agent("AnswerScope/0.1 (+https://answerscope.ai)")
            .build()
            .map_err(|e| ProviderError::Request(e.to_string()))?;
        Ok(Self { client, api_key, estimate_microusd })
    }
}

#[async_trait]
impl AiObservationProvider for SerpApi {
    fn provider_id(&self) -> &'static str {
        "serpapi_google"
    }
    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            surfaces: vec!["google_ai_overview".into(), "google_ai_mode".into()],
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
        Ok(self.estimate_microusd)
    }
    async fn execute(
        &self,
        request: ObservationRequest,
    ) -> Result<NormalizedObservation, ProviderError> {
        let (location, hl, gl) = match request.country.to_ascii_uppercase().as_str() {
            "US" => ("United States", "en", "us"),
            "GB" | "UK" => ("United Kingdom", "en", "uk"),
            "CA" => ("Canada", "en", "ca"),
            "AU" => ("Australia", "en", "au"),
            _ => {
                return Err(ProviderError::InvalidResponse(
                    "SerpApi location is not enabled for this adapter".into(),
                ));
            }
        };
        if !request.language.eq_ignore_ascii_case(hl) {
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
        let surface = request
            .parameters
            .get("surface")
            .and_then(Value::as_str)
            .filter(|v| *v == "google_ai_mode" || *v == "google_ai_overview")
            .unwrap_or("google_ai_overview");

        let mut query_params = vec![
            ("q", request.prompt.as_str()),
            ("api_key", self.api_key.as_str()),
            ("hl", hl),
            ("gl", gl),
            ("location", location),
            ("source", "answerscope"),
            ("tag", tag),
        ];
        if surface == "google_ai_mode" {
            query_params.push(("ai_mode", "1"));
        }

        let response = self
            .client
            .get("https://serpapi.com/search.json")
            .query(&query_params)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    ProviderError::Request("provider timeout".into())
                } else {
                    ProviderError::Request(e.to_string())
                }
            })?;

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

        let ai_data = payload.get("ai_overview").or_else(|| payload.get("ai_mode"));
        let answer_text = ai_data
            .and_then(|v| v.get("answer").and_then(Value::as_str))
            .unwrap_or("")
            .to_owned();

        let mut citations = Vec::new();
        if let Some(items) = ai_data.and_then(|v| v.get("sources")).and_then(Value::as_array) {
            for item in items {
                if let Some(url) = item.get("link").and_then(Value::as_str) {
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
                            .or_else(|| answerscope_ai_visibility::citation_domain(url)),
                    });
                }
            }
        }
        // Also check organic results for cited domains when AI overview has none.
        if citations.is_empty() {
            if let Some(items) = payload.get("organic_results").and_then(Value::as_array) {
                for item in items.iter().take(10) {
                    if let Some(url) = item.get("link").and_then(Value::as_str) {
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
                                .or_else(|| answerscope_ai_visibility::citation_domain(url)),
                        });
                    }
                }
            }
        }

        let cost = payload
            .get("search_metadata")
            .and_then(|v| v.get("currency").and_then(Value::as_str))
            .filter(|c| *c == "USD")
            .and_then(|_| payload.get("search_metadata").and_then(|v| v.get("total_cost").and_then(Value::as_f64)))
            .map(|v| (v * 1_000_000.0).round() as i64);

        let mut limitations = vec![
            "A sampled SerpApi result is an observation for this exact prompt, location, language, and collection time; it does not estimate all user impressions.".into(),
        ];
        if answer_text.trim().is_empty() {
            limitations.push("The provider response contained no AI answer text.".into());
        }
        if citations.is_empty() {
            limitations.push("The provider returned no citation URLs for this observation.".into());
        }

        Ok(NormalizedObservation {
            provider_id: self.provider_id().into(),
            engine: "Google".into(),
            surface: surface.to_string(),
            answer_text,
            citations,
            raw_response: payload,
            provider_cost_microusd: cost,
            limitations,
        })
    }
}
