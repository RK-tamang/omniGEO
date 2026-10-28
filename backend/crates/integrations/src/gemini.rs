//! Gemini LLM Scraper provider adapter.
//!
//! Collects observed responses from Gemini Search surfaces using the
//! documented Generative Language API. Outputs are explicitly marked as
//! consumer-search observations, not direct LLM model responses.

use answerscope_ai_visibility::{
    AiObservationProvider, Citation, NormalizedObservation, ObservationRequest,
    ProviderCapabilities, ProviderError,
};
use async_trait::async_trait;
use serde_json::{Value, json};

pub struct GeminiScraper {
    client: reqwest::Client,
    api_key: String,
    estimate_microusd: i64,
}

impl GeminiScraper {
    pub fn from_env() -> Result<Self, ProviderError> {
        let api_key = std::env::var("GEMINI_API_KEY")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| ProviderError::NotConfigured("GEMINI_API_KEY".into()))?;
        let estimate_microusd = std::env::var("GEMINI_ESTIMATED_COST_MICRO_USD").ok()
            .and_then(|v| v.parse::<i64>().ok()).filter(|v| *v > 0)
            .ok_or_else(|| ProviderError::NotConfigured("GEMINI_ESTIMATED_COST_MICRO_USD must be set to the configured conservative per-request price".into()))?;
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(125))
            .user_agent("AnswerScope/0.1 (+https://answerscope.ai)")
            .build()
            .map_err(|e| ProviderError::Request(e.to_string()))?;
        Ok(Self { client, api_key, estimate_microusd })
    }
}

#[async_trait]
impl AiObservationProvider for GeminiScraper {
    fn provider_id(&self) -> &'static str {
        "gemini_search"
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
        Ok(self.estimate_microusd)
    }
    async fn execute(
        &self,
        request: ObservationRequest,
    ) -> Result<NormalizedObservation, ProviderError> {
        let language_code = match request.country.to_ascii_uppercase().as_str() {
            "US" | "GB" | "UK" | "CA" | "AU" => "en",
            _ => {
                return Err(ProviderError::InvalidResponse(
                    "Gemini Search location is not enabled for this adapter".into(),
                ));
            }
        };
        if !request.language.eq_ignore_ascii_case(language_code) {
            return Err(ProviderError::InvalidResponse(
                "language is not supported for the selected country".into(),
            ));
        }

        // Generative Language API - Gemini 1.5 Pro with Google Search grounding
        // Using the documented generateContent endpoint with google_search_retrieval tool
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={}",
            self.api_key
        );

        let body = json!({
            "contents": [{
                "parts": [{
                    "text": format!("{}\n\nGround your answer in current web search results. Cite your sources using [source] format with URLs.", request.prompt)
                }]
            }],
            "tools": [{
                "google_search_retrieval": {}
            }],
            "generation_config": {
                "temperature": 0.3,
                "max_output_tokens": 2048
            },
            "safety_settings": []
        });

        let response = self
            .client
            .post(&url)
            .json(&body)
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
            let message = payload
                .get("error")
                .and_then(|v| v.get("message").and_then(Value::as_str))
                .unwrap_or("provider request failed")
                .to_owned();
            return Err(ProviderError::Request(message));
        }

        let candidates = payload
            .get("candidates")
            .and_then(Value::as_array)
            .ok_or_else(|| ProviderError::InvalidResponse("response has no candidates".into()))?;

        let candidate = candidates
            .first()
            .ok_or_else(|| ProviderError::InvalidResponse("no candidate returned".into()))?;

        let answer_text = candidate
            .get("content")
            .and_then(|v| v.get("parts"))
            .and_then(|v| v.as_array())
            .and_then(|parts| parts.first())
            .and_then(|part| part.get("text").and_then(Value::as_str))
            .unwrap_or("")
            .to_owned();

        let mut citations = Vec::new();
        // Extract grounding citations from groundingMetadata
        if let Some(grounding) = candidate.get("groundingMetadata") {
            if let Some(chunks) = grounding.get("groundingChunks").and_then(Value::as_array) {
                for chunk in chunks {
                    if let Some(url) = chunk.get("web").and_then(|v| v.get("uri").and_then(Value::as_str)) {
                        if citations.iter().any(|c: &Citation| c.url == url) {
                            continue;
                        }
                        citations.push(Citation {
                            url: url.to_owned(),
                            title: chunk.get("web").and_then(|v| v.get("title").and_then(Value::as_str)).map(str::to_owned),
                            source_domain: chunk.get("web").and_then(|v| v.get("uri").and_then(Value::as_str)).and_then(|u| answerscope_ai_visibility::citation_domain(u)),
                        });
                    }
                }
            }
        }

        let cost = None; // Gemini does not report per-request cost in this API version; settled from estimate

        let mut limitations = vec![
            "A sampled Gemini Search result is an observation for this exact prompt, location, language, and collection time; it does not estimate all user impressions.".into(),
        ];
        if answer_text.trim().is_empty() {
            limitations.push("The provider response contained no answer text.".into());
        }
        if citations.is_empty() {
            limitations.push("The provider returned no citation URLs for this observation.".into());
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
