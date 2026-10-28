//! Opportunity generation from audit findings.
//!
//! Converts failing rules into actionable, prioritized opportunities.

use crate::domain::{AuditContext, Finding, RuleCategory, RuleResult, RuleStatus, Severity};
use crate::scoring::Opportunity;
use serde_json::Value;

/// Convert rule results into deduplicated opportunities.
pub fn generate_opportunities(results: &[RuleResult], _context: &AuditContext) -> Vec<Opportunity> {
    crate::scoring::generate_opportunities(results)
}

/// Build a detailed opportunity from a finding with additional context.
pub fn build_opportunity(
    finding: &Finding,
    context: &AuditContext,
) -> Opportunity {
    let priority = match finding.severity {
        Severity::Critical => "critical",
        Severity::High => "high",
        Severity::Medium => "medium",
        Severity::Low => "low",
        Severity::Info => "low",
    };
    let effort = match finding.severity {
        Severity::Critical | Severity::High => "large",
        Severity::Medium => "medium",
        Severity::Low | Severity::Info => "small",
    };
    Opportunity {
        title: finding.message.clone(),
        explanation: finding.explanation.clone().unwrap_or_else(|| finding.message.clone()),
        category: finding.category,
        severity: finding.severity,
        priority: priority.to_owned(),
        estimated_effort: effort.to_owned(),
        confidence: finding.confidence,
        status: "open".to_owned(),
        affected_urls: finding.affected_url.as_ref().cloned().into_iter().collect(),
        related_finding_codes: vec![finding.rule_id.clone()],
        suggested_fix: finding.recommended_fix.clone(),
    }
}

/// Group opportunities by category for dashboard display.
pub fn group_by_category(opportunities: &[Opportunity]) -> Vec<(RuleCategory, Vec<&Opportunity>)> {
    use std::collections::BTreeMap;
    let mut map: BTreeMap<RuleCategory, Vec<&Opportunity>> = BTreeMap::new();
    for opp in opportunities {
        map.entry(opp.category).or_default().push(opp);
    }
    map.into_iter().collect()
}

/// Count opportunities by priority.
pub fn count_by_priority(opportunities: &[Opportunity]) -> Vec<(String, usize)> {
    let mut counts: std::collections::BTreeMap<String, usize> = std::collections::BTreeMap::new();
    for opp in opportunities {
        *counts.entry(opp.priority.clone()).or_insert(0) += 1;
    }
    counts.into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::*;
    use crate::rules::*;
    use uuid::Uuid;

    fn ctx() -> AuditContext {
        AuditContext {
            audit_run_id: Uuid::new_v4(),
            project_id: None,
            organization_id: None,
            requested_url: "https://example.com/page".to_owned(),
            canonical_url: None,
            http_status: Some(200),
            content_type: Some("text/html".to_owned()),
            title: None,
            meta_description: None,
            meta_robots: None,
            x_robots_tag: None,
            language: None,
            viewport: None,
            open_graph: serde_json::json!({}),
            headings: Vec::new(),
            main_text: String::new(),
            word_count: 0,
            links: Vec::new(),
            images: Vec::new(),
            structured_data: Vec::new(),
            robots_document: None,
            sitemap_urls: Vec::new(),
            crawl_depth: 0,
            redirect_chain: Vec::new(),
            content_hash: None,
        }
    }

    #[test]
    fn generate_opportunities_from_results() {
        let results = vec![
            make_result("crawlability.http_status_ok", RuleCategory::Crawlability, RuleStatus::Fail, Some(Severity::High)),
        ];
        let opps = generate_opportunities(&results, &ctx());
        assert_eq!(opps.len(), 1);
        assert_eq!(opps[0].priority, "high");
    }

    #[test]
    fn group_by_category_works() {
        let results = vec![
            make_result("crawlability.http_status_ok", RuleCategory::Crawlability, RuleStatus::Fail, Some(Severity::High)),
            make_result("metadata.title_present", RuleCategory::Metadata, RuleStatus::Fail, Some(Severity::Low)),
        ];
        let opps = generate_opportunities(&results, &ctx());
        let grouped = group_by_category(&opps);
        assert_eq!(grouped.len(), 2);
    }

    #[test]
    fn count_by_priority() {
        let results = vec![
            make_result("crawlability.a", RuleCategory::Crawlability, RuleStatus::Fail, Some(Severity::Critical)),
            make_result("crawlability.b", RuleCategory::Crawlability, RuleStatus::Fail, Some(Severity::High)),
            make_result("metadata.c", RuleCategory::Metadata, RuleStatus::Fail, Some(Severity::High)),
        ];
        let opps = generate_opportunities(&results, &ctx());
        let counts = count_by_priority(&opps);
        let counts_map: std::collections::HashMap<_, _> = counts.into_iter().collect();
        assert_eq!(counts_map.get("critical"), Some(&1));
        assert_eq!(counts_map.get("high"), Some(&2));
    }
}
