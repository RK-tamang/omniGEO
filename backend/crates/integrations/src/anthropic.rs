//! Anthropic Claude provider adapter.
//!
//! Collects model responses from Claude via the Anthropic Messages API.
//! Outputs are explicitly marked as direct LLM model responses, not observed
//! consumer AI search results.

use answerscope_ai_visibility::{
    AiObservationProvider, Citation, NormalizedObservation, ObservationRequest,
    ProviderCapabilities, ProviderError,
};
use async_trait::async_trait;
use serde_json::{Value, json};

pub struct AnthropicClaude {
    client: reqwest::Client,
    api_key: String,
    estimate_microusd: i64,
}

impl AnthropicClaude {
    pub fn from_env() -> Result<Self, ProviderError> {
        let api_key = std::env::var("ANTHROPIC_API_KEY")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| ProviderError::NotConfigured("ANTHROPIC_API_KEY".into()))?;
        let estimate_microusd = std::env::var("ANTHROPIC_ESTIMATED_COST_MICRO_USD").ok()
            .and_then(|v| v.parse::<i64>().ok()).filter(|v| *v > 0)
            .ok_or_else(|| ProviderError::NotConfigured("ANTHROPIC_ESTIMATED_COST_MICRO_USD must be set to the configured conservative per-request price".into()))?;
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(125))
            .user_agent("AnswerScope/0.1 (+https://answerscope.ai)")
            .build()
            .map_err(|e| ProviderError::Request(e.to_string()))?;
        Ok(Self { client, api_key, estimate_microusd })
    }
}

#[async_trait]
impl AiObservationProvider for AnthropicClaude {
    fn provider_id(&self) -> &'static str {
        "anthropic_claude"
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
            .unwrap_or("claude-3-haiku-20240307")
            .to_owned();

        let body = json!({
            "model": model,
            "max_tokens": 2048,
            "temperature": 0.3,
            "system": "You are a helpful assistant. Answer the user's question directly and accurately.",
            "messages": [
                { "role": "user", "content": request.prompt }
            ]
        });

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
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

        let answer_text = payload
            .get("content")
            .and_then(Value::as_array)
            .and_then(|items| items.iter().find_map(|item| {
                if item.get("type").and_then(Value::as_str) == Some("text") {
                    item.get("text").and_then(Value::as_str).map(str::to_owned)
                } else {
                    None
                }
            }))
            .unwrap_or_default();

        let mut citations = Vec::new();
        if let Some(text) = payload.get("content").and_then(Value::as_array) {
            for item in text {
                if let Some(citations_arr) = item.get("citations").and_then(Value::as_array) {
                    for cit in citations_arr {
                        if let Some(url) = cit.get("url").and_then(Value::as_str) {
                            if citations.iter().any(|c: &Citation| c.url == url) {
                                continue;
                            }
                            citations.push(Citation {
                                url: url.to_owned(),
                                title: cit.get("title").and_then(Value::as_str).map(str::to_owned),
                                source_domain: answerscope_ai_visibility::citation_domain(url),
                            });
                        }
                    }
                }
            }
        }

        let mut limitations = vec![
            "This is a direct LLM model response, not an observed consumer AI search result. It does not reflect what consumers see in AI search engines.".into(),
        ];
        if answer_text.trim().is_empty() {
            limitations.push("The provider response contained no answer text.".into());
        }

        Ok(NormalizedObservation {
            provider_id: self.provider_id().into(),
            engine: "Claude".into(),
            surface: "model_response".into(),
            answer_text,
            citations,
            raw_response: payload,
            provider_cost_microusd: None,
            limitations,
        })
    }
}
