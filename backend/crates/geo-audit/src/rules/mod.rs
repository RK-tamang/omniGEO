//! Individual audit rules, organized by category.
//!
//! Each rule implements `domain::AuditRule` and evaluates against
//! `domain::AuditContext`. Rules are independent and can be run in any order.

pub mod crawlability;
pub mod robots;
pub mod sitemap;
pub mod structured_data;

use crate::domain::{AuditContext, AuditRule, RuleCategory, RuleResult, RuleStatus, Severity};

/// Helper to build a passing rule result.
pub fn pass(rule_id: &'static str, version: u32, category: RuleCategory, message: impl Into<String>) -> RuleResult {
    RuleResult {
        rule_id: rule_id.to_owned(),
        rule_version: version,
        category,
        status: RuleStatus::Pass,
        severity: None,
        confidence: 1.0,
        penalty_contribution: 0.0,
        message: message.into(),
        explanation: None,
        recommended_fix: None,
        evidence: serde_json::json!({}),
        findings: Vec::new(),
    }
}

/// Helper to build a failing rule result with a finding.
pub fn fail(
    rule_id: &'static str,
    version: u32,
    category: RuleCategory,
    severity: Severity,
    message: impl Into<String>,
    evidence: serde_json::Value,
    finding: Option<crate::domain::Finding>,
) -> RuleResult {
    let findings = finding.into_iter().collect();
    RuleResult {
        rule_id: rule_id.to_owned(),
        rule_version: version,
        category,
        status: RuleStatus::Fail,
        severity: Some(severity),
        confidence: 0.9,
        penalty_contribution: match severity {
            Severity::Critical => 25.0,
            Severity::High => 15.0,
            Severity::Medium => 8.0,
            Severity::Low => 3.0,
            Severity::Info => 1.0,
        },
        message: message.into(),
        explanation: None,
        recommended_fix: None,
        evidence,
        findings,
    }
}

/// Helper to build a warning result.
pub fn warning(
    rule_id: &'static str,
    version: u32,
    category: RuleCategory,
    message: impl Into<String>,
    evidence: serde_json::Value,
) -> RuleResult {
    RuleResult {
        rule_id: rule_id.to_owned(),
        rule_version: version,
        category,
        status: RuleStatus::Warning,
        severity: Some(Severity::Low),
        confidence: 0.8,
        penalty_contribution: 3.0,
        message: message.into(),
        explanation: None,
        recommended_fix: None,
        evidence,
        findings: Vec::new(),
    }
}

/// Helper to build a skipped/unavailable result.
pub fn unavailable(
    rule_id: &'static str,
    version: u32,
    category: RuleCategory,
    reason: impl Into<String>,
) -> RuleResult {
    let reason_str: String = reason.into();
    RuleResult {
        rule_id: rule_id.to_owned(),
        rule_version: version,
        category,
        status: RuleStatus::Unavailable,
        severity: None,
        confidence: 0.0,
        penalty_contribution: 0.0,
        message: reason_str.clone(),
        explanation: None,
        recommended_fix: None,
        evidence: serde_json::json!({"reason": reason_str}),
        findings: Vec::new(),
    }
}

/// Build a Finding from a rule result.
pub fn make_finding(
    rule_id: &'static str,
    version: u32,
    category: RuleCategory,
    status: RuleStatus,
    severity: Severity,
    affected_url: Option<String>,
    affected_element: Option<String>,
    evidence: serde_json::Value,
    message: impl Into<String>,
    explanation: Option<String>,
    recommended_fix: Option<String>,
    confidence: f64,
) -> crate::domain::Finding {
    crate::domain::Finding {
        rule_id: rule_id.to_owned(),
        rule_version: version,
        category,
        status,
        severity,
        affected_url,
        affected_element,
        evidence,
        message: message.into(),
        explanation,
        recommended_fix,
        confidence,
    }
}

/// Evaluate whether an HTTP status is a client or server error.
pub fn is_error_status(status: u16) -> bool {
    status >= 400
}

/// Evaluate whether an HTTP status is a redirect.
pub fn is_redirect(status: u16) -> bool {
    status >= 300 && status < 400
}

/// Check if a URL path looks like an important page (home, about, services, contact).
pub fn is_important_path(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    ["about", "contact", "services", "products", "pricing", "solutions", "team"]
        .iter()
        .any(|term| lower.contains(term))
}

/// Build a URL fingerprint from a rule result for deduplication.
pub fn fingerprint(rule_id: &str, url: Option<&str>, element: Option<&str>) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    rule_id.hash(&mut hasher);
    url.hash(&mut hasher);
    element.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}
