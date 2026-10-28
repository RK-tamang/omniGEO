//! Stable feature-key entitlement evaluation shared by API and worker services.
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntitlementDecision {
    pub allowed: bool,
    pub feature_key: String,
    pub limit: Option<i64>,
    pub current_usage: i64,
    pub remaining: Option<i64>,
    pub reason: Option<String>,
}

pub fn evaluate_feature(
    features: &Value,
    key: &str,
    current_usage: i64,
    proposed_usage: i64,
) -> EntitlementDecision {
    let value = features.get(key);
    let enabled = value.is_some_and(|v| {
        v == &Value::Bool(true)
            || v.as_i64().is_some_and(|n| n >= 0)
            || v.get("enabled").and_then(Value::as_bool) == Some(true)
    });
    let limit = value
        .and_then(|v| {
            v.as_i64()
                .or_else(|| v.get("limit").and_then(Value::as_i64))
        })
        .filter(|v| *v >= 0);
    let remaining = limit.map(|v| (v - current_usage).max(0));
    let within = limit.is_none_or(|v| current_usage.saturating_add(proposed_usage) <= v);
    let allowed = enabled && within && proposed_usage >= 0;
    EntitlementDecision {
        allowed,
        feature_key: key.into(),
        limit,
        current_usage,
        remaining,
        reason: if allowed {
            None
        } else if !enabled {
            Some("feature is not included in the effective plan".into())
        } else if !within {
            Some("feature usage limit reached".into())
        } else {
            Some("proposed usage cannot be negative".into())
        },
    }
}
