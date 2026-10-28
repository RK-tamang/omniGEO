//! Response normalization for DataForSEO adapters.

use answerscope_ai_visibility::{Citation, NormalizedObservation, ObservationRequest};
use serde_json::Value;
use std::collections::HashSet;

use crate::dataforseo::{dedup_citations, citation_domain, citation_from_item};

/// Build a NormalizedObservation from a DataForSEO task result.
pub fn normalize_observation(
    provider_id: &str,
    engine: &str,
    surface: &str,
    request: &ObservationRequest,
    result: &Value,
    cost_microusd: Option<i64>,
) -> NormalizedObservation {
    let answer_text = result
        .get("markdown")
        .or_else(|| result.get("content"))
        .or_else(|| result.get("text"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned();

    let mut citations = Vec::new();
    if let Some(items) = result.get("sources").and_then(Value::as_array) {
        for item in items {
            if let Some(c) = citation_from_item(item) {
                citations.push(c);
            }
        }
    }
    if let Some(items) = result.get("search_results").and_then(Value::as_array) {
        for item in items {
            if let Some(c) = citation_from_item(item) {
                citations.push(c);
            }
        }
    }
    citations = dedup_citations(citations);

    let mut limitations = vec![
        "A sampled AI search result is an observation for this exact prompt, location, language, and collection time; it does not estimate all user impressions.".to_owned(),
    ];
    if citations.is_empty() {
        limitations.push("The provider returned no citation URLs for this observation.".to_owned());
    }

    NormalizedObservation {
        provider_id: provider_id.to_owned(),
        engine: engine.to_owned(),
        surface: surface.to_owned(),
        answer_text,
        citations,
        raw_response: result.clone(),
        provider_cost_microusd: cost_microusd,
        limitations,
    }
}

/// Extract a Deduplicated list of cited domains from observations.
pub fn extract_domains(citations: &[Citation]) -> Vec<String> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut out: Vec<String> = Vec::new();
    for c in citations {
        if let Some(domain) = &c.source_domain {
            if seen.insert(domain.clone()) {
                out.push(domain.clone());
            }
        }
    }
    out.sort();
    out
}
