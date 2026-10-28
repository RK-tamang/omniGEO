//! DataForSEO ChatGPT Search scraper adapter. This uses the official
//! `ai_optimization/chat_gpt/llm_scraper/live/advanced` endpoint, not an LLM
//! generation endpoint, so outputs are explicitly marked as search observations.
use answerscope_ai_visibility::{
    AiObservationProvider, Citation, NormalizedObservation, ObservationRequest,
    ProviderCapabilities, ProviderError,
};
use async_trait::async_trait;
use serde_json::{Value, json};

pub struct DataForSeoChatGptSearch {
    client: reqwest::Client,
    login: String,
    password: String,
    /// Conservative reservation price in micro-USD, configured from verified
    /// account pricing; actual task cost is settled from the provider response.
    estimate_microusd: i64,
}

impl DataForSeoChatGptSearch {
    pub fn from_env() -> Result<Self, ProviderError> {
        let login = std::env::var("DATAFORSEO_LOGIN")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| ProviderError::NotConfigured("DATAFORSEO_LOGIN".into()))?;
        let password = std::env::var("DATAFORSEO_PASSWORD")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| ProviderError::NotConfigured("DATAFORSEO_PASSWORD".into()))?;
        let estimate_microusd = std::env::var("DATAFORSEO_ESTIMATED_COST_MICRO_USD").ok()
            .and_then(|v| v.parse::<i64>().ok()).filter(|v| *v > 0)
            .ok_or_else(|| ProviderError::NotConfigured("DATAFORSEO_ESTIMATED_COST_MICRO_USD must be set to the configured conservative per-request price".into()))?;
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(125))
            .user_agent("AnswerScope/0.1 (+https://answerscope.ai)")
            .build()
            .map_err(|e| ProviderError::Request(e.to_string()))?;
        Ok(Self {
            client,
            login,
            password,
            estimate_microusd,
        })
    }
}

#[async_trait]
impl AiObservationProvider for DataForSeoChatGptSearch {
    fn provider_id(&self) -> &'static str {
        "dataforseo_chatgpt_search"
    }
    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            surfaces: vec!["chatgpt_search".into()],
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
        let (location_name, language_code) = match request.country.to_ascii_uppercase().as_str() {
            "US" => ("United States", "en"),
            "GB" | "UK" => ("United Kingdom", "en"),
            "CA" => ("Canada", "en"),
            "AU" => ("Australia", "en"),
            _ => {
                return Err(ProviderError::InvalidResponse(
                    "DataForSEO ChatGPT Search location is not enabled for this adapter".into(),
                ));
            }
        };
        if !request.language.eq_ignore_ascii_case(language_code) {
            return Err(ProviderError::InvalidResponse(
                "language is not supported for the selected country".into(),
            ));
        }
        let tag = request
            .parameters
            .get("tag")
            .and_then(serde_json::Value::as_str)
            .filter(|v| v.len() <= 255)
            .unwrap_or("answerscope");
        let body = json!([{"keyword":request.prompt,"location_name":location_name,"language_code":language_code,"force_web_search":true,"tag":tag}]);
        let response = self
            .client
            .post(
                "https://api.dataforseo.com/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced",
            )
            .basic_auth(&self.login, Some(&self.password))
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
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned();
        let mut citations = Vec::new();
        for key in ["sources", "search_results"] {
            if let Some(items) = result.get(key).and_then(Value::as_array) {
                for item in items {
                    if let Some(url) = item
                        .get("url")
                        .and_then(Value::as_str)
                        .filter(|u| u.starts_with("https://") || u.starts_with("http://"))
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
                                .or_else(|| answerscope_ai_visibility::citation_domain(url)),
                        });
                    }
                }
            }
        }
        let cost = task
            .get("cost")
            .and_then(Value::as_f64)
            .or_else(|| payload.get("cost").and_then(Value::as_f64))
            .map(|v| (v * 1_000_000.0).round() as i64);
        Ok(NormalizedObservation { provider_id:self.provider_id().into(), engine:"ChatGPT".into(), surface:"chatgpt_search".into(), answer_text, citations, raw_response:payload, provider_cost_microusd:cost, limitations:vec!["A sampled ChatGPT Search result is an observation for this exact prompt, location, language, and collection time; it does not estimate all user impressions.".into()] })
    }
}
