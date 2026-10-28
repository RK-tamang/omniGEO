//! LLM Responses API provider adapter.
//!
//! Evaluates direct model responses using documented models. Results are
//! explicitly labeled as model-generated responses, never as observed
//! consumer ChatGPT or Gemini search results.

use answerscope_ai_visibility::{
    AiObservationProvider, Citation, NormalizedObservation, ObservationRequest,
    ProviderCapabilities, ProviderError,
};
use async_trait::async_trait;
use serde_json::{Value, json};

pub struct LlmResponsesApi {
    client: reqwest::Client,
    api_key: String,
    estimate_microusd: i64,
}

impl LlmResponsesApi {
    pub fn from_env() -> Result<Self, ProviderError> {
        let api_key = std::env::var("OPENAI_API_KEY")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| ProviderError::NotConfigured("OPENAI_API_KEY".into()))?;
        let estimate_microusd = std::env::var("LLM_RESPONSES_ESTIMATED_COST_MICRO_USD").ok()
            .and_then(|v| v.parse::<i64>().ok()).filter(|v| *v > 0)
            .ok_or_else(|| ProviderError::NotConfigured("LLM_RESPONSES_ESTIMATED_COST_MICRO_USD must be set to the configured conservative per-request price".into()))?;
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(125))
            .user_agent("AnswerScope/0.1 (+https://answerscope.ai)")
            .build()
            .map_err(|e| ProviderError::Request(e.to_string()))?;
        Ok(Self { client, api_key, estimate_microusd })
    }
}

#[async_trait]
impl AiObservationProvider for LlmResponsesApi {
    fn provider_id(&self) -> &'static str {
        "openai_responses_api"
    }
    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            surfaces: vec!["model_response".into()],
            countries: vec!["US".into()],
            languages: vec!["en".into()],
            max_prompt_chars: 2000,
            is_consumer_search_observation: false,
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
        let model = request
            .parameters
            .get("model")
            .and_then(Value::as_str)
            .unwrap_or("gpt-4o-mini")
            .to_owned();

        let body = json!({
            "model": model,
            "input": request.prompt,
            "instructions": "You are a helpful assistant. Answer the user's question directly and accurately. If you reference web sources, include them inline.",
            "max_output_tokens": 2048,
            "temperature": 0.3
        });

        let response = self
            .client
            .post("https://api.openai.com/v1/responses")
            .bearer_auth(&self.api_key)
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

        // Extract output text from the Responses API
        let answer_text = payload
            .get("output")
            .and_then(Value::as_array)
            .and_then(|items| items.iter().find_map(|item| {
                if item.get("type").and_then(Value::as_str) == Some("message") {
                    item.get("content")
                        .and_then(Value::as_array)
                        .and_then(|content| content.iter().find_map(|c| {
                            if c.get("type").and_then(Value::as_str) == Some("output_text") {
                                c.get("text").and_then(Value::as_str).map(str::to_owned)
                            } else {
                                None
                            }
                        }))
                } else {
                    None
                }
            }))
            .unwrap_or_default();

        let mut citations = Vec::new();
        // Extract any URLs cited in the response text or annotations
        if let Some(output) = payload.get("output").and_then(Value::as_array) {
            for item in output {
                if let Some(content) = item.get("content").and_then(Value::as_array) {
                    for c in content {
                        if let Some(annotations) = c.get("annotations").and_then(Value::as_array) {
                            for ann in annotations {
                                if let Some(url) = ann.get("url").and_then(Value::as_str) {
                                    if citations.iter().any(|c: &Citation| c.url == url) {
                                        continue;
                                    }
                                    citations.push(Citation {
                                        url: url.to_owned(),
                                        title: ann.get("title").and_then(Value::as_str).map(str::to_owned),
                                        source_domain: answerscope_ai_visibility::citation_domain(url),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        let usage = payload.get("usage");
        let total_tokens = usage
            .and_then(|v| v.get("total_tokens").and_then(Value::as_u64))
            .unwrap_or(0) as i64;
        // Approximate cost: $0.15 per 1M input tokens, $0.60 per 1M output tokens for gpt-4o-mini
        // Conservative estimate based on tokens
        let cost = if total_tokens > 0 {
            Some((total_tokens as f64 * 0.0000006).round() as i64)
        } else {
            None
        };

        let mut limitations = vec![
            "This is a direct LLM model response, not an observed consumer AI search result. It does not reflect what consumers see in AI search engines.".into(),
        ];
        if answer_text.trim().is_empty() {
            limitations.push("The provider response contained no answer text.".into());
        }

        Ok(NormalizedObservation {
            provider_id: self.provider_id().into(),
            engine: "GPT".into(),
            surface: "model_response".into(),
            answer_text,
            citations,
            raw_response: payload,
            provider_cost_microusd: cost,
            limitations,
        })
    }
}
