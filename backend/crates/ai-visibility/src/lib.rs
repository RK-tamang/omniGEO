//! Domain contracts and deterministic analysis for observed AI search results.
//! Model-generated answers are represented as a distinct surface and must never
//! be counted as consumer-search observations.
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservationRequest {
    pub prompt: String,
    pub country: String,
    pub language: String,
    pub parameters: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Citation {
    pub url: String,
    pub title: Option<String>,
    pub source_domain: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedObservation {
    pub provider_id: String,
    pub engine: String,
    pub surface: String,
    pub answer_text: String,
    pub citations: Vec<Citation>,
    pub raw_response: Value,
    pub provider_cost_microusd: Option<i64>,
    pub limitations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    pub surfaces: Vec<String>,
    pub countries: Vec<String>,
    pub languages: Vec<String>,
    pub max_prompt_chars: usize,
    pub is_consumer_search_observation: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("provider is not configured: {0}")]
    NotConfigured(String),
    #[error("provider quota exceeded")]
    QuotaExceeded,
    #[error("provider request failed: {0}")]
    Request(String),
    #[error("provider response could not be normalized: {0}")]
    InvalidResponse(String),
}

/// Provider interface used by durable observation jobs. `estimate_cost` is a
/// quote in integer micro-USD; adapters must not guess a price when unconfigured.
#[async_trait::async_trait]
pub trait AiObservationProvider: Send + Sync {
    fn provider_id(&self) -> &'static str;
    fn capabilities(&self) -> ProviderCapabilities;
    fn estimate_cost(&self, request: &ObservationRequest) -> Result<i64, ProviderError>;
    async fn execute(
        &self,
        request: ObservationRequest,
    ) -> Result<NormalizedObservation, ProviderError>;
}

/// Exact alias matching with Unicode-aware case folding is deliberately
/// conservative: aliases shorter than three characters are ignored.
pub fn find_alias_mentions(text: &str, aliases: &[String]) -> Vec<String> {
    let folded = text.to_lowercase();
    let mut found = aliases
        .iter()
        .filter(|alias| alias.trim().chars().count() >= 3)
        .filter(|alias| {
            let needle = alias.trim().to_lowercase();
            folded.match_indices(&needle).any(|(start, matched)| {
                let end = start + matched.len();
                let left_ok = folded[..start]
                    .chars()
                    .next_back()
                    .is_none_or(|ch| !ch.is_alphanumeric());
                let right_ok = folded[end..]
                    .chars()
                    .next()
                    .is_none_or(|ch| !ch.is_alphanumeric());
                left_ok && right_ok
            })
        })
        .cloned()
        .collect::<Vec<_>>();
    found.sort_by_key(|alias| alias.to_lowercase());
    found.dedup_by(|left, right| left.eq_ignore_ascii_case(right));
    found
}

pub fn citation_domain(url: &str) -> Option<String> {
    url::Url::parse(url)
        .ok()?
        .host_str()
        .map(str::to_ascii_lowercase)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find_alias_mentions_exact_case_insensitive() {
        let text = "Acme Corp is the best choice for enterprise software.";
        let aliases = vec!["Acme Corp".to_string(), "acme".to_string()];
        let found = find_alias_mentions(text, &aliases);
        assert!(found.iter().any(|a| a.eq_ignore_ascii_case("Acme Corp")));
        // "acme" is a substring of "Acme Corp" but word-boundary matching means
        // "acme" inside "Acme" should still match since there's no alphanumeric boundary issue
        // Actually "acme" as standalone would match in "Acme Corp" at the start
        assert!(found.len() >= 1);
    }

    #[test]
    fn find_alias_mentions_ignores_short_aliases() {
        let text = "AI and ML are great technologies.";
        let aliases = vec!["AI".to_string(), "ML".to_string()]; // both < 3 chars
        let found = find_alias_mentions(text, &aliases);
        assert!(found.is_empty());
    }

    #[test]
    fn find_alias_mentions_word_boundary() {
        let text = "The microsoft ecosystem includes Microsoft Azure and Microsoft 365.";
        let aliases = vec!["microsoft".to_string()];
        let found = find_alias_mentions(text, &aliases);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0], "microsoft");
    }

    #[test]
    fn find_alias_mentions_no_false_positive() {
        let text = "The classification system is robust.";
        let aliases = vec!["class".to_string()]; // < 3 chars, ignored
        let found = find_alias_mentions(text, &aliases);
        assert!(found.is_empty());

        let aliases2 = vec!["classification".to_string()];
        let found2 = find_alias_mentions(text, &aliases2);
        assert_eq!(found2.len(), 1);
    }

    #[test]
    fn citation_domain_extracts_host() {
        let domain = citation_domain("https://www.example.com/path/to/page");
        assert_eq!(domain, Some("www.example.com".to_string()));
    }

    #[test]
    fn citation_domain_handles_case() {
        let domain = citation_domain("HTTPS://WWW.Example.COM/path");
        assert_eq!(domain, Some("www.example.com".to_string()));
    }

    #[test]
    fn citation_domain_rejects_invalid() {
        let domain = citation_domain("not-a-url");
        assert_eq!(domain, None);
    }

    #[test]
    fn normalized_observation_serialization() {
        let obs = NormalizedObservation {
            provider_id: "test_provider".to_string(),
            engine: "TestEngine".to_string(),
            surface: "model_response".to_string(),
            answer_text: "This mentions Acme Corp and cites sources.".to_string(),
            citations: vec![Citation {
                url: "https://example.com/source".to_string(),
                title: Some("Example Source".to_string()),
                source_domain: Some("example.com".to_string()),
            }],
            raw_response: serde_json::json!({"id": "resp_123"}),
            provider_cost_microusd: Some(500),
            limitations: vec!["Test limitation".to_string()],
        };
        let json = serde_json::to_value(&obs).unwrap();
        assert_eq!(json["provider_id"], "test_provider");
        assert_eq!(json["engine"], "TestEngine");
        assert_eq!(json["surface"], "model_response");
        assert_eq!(json["citations"][0]["url"], "https://example.com/source");
        assert_eq!(json["provider_cost_microusd"], 500);
    }
}
