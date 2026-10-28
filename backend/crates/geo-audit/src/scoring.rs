//! Technical GEO Readiness scoring engine.
//!
//! Combines rule results into category scores and an overall readiness score.
//! Weights are internal product heuristics, not validated search-engine ranking weights.

use crate::domain::{AuditContext, RuleCategory, RuleResult, RuleStatus, Severity};
use crate::rules::*;
use serde::{Deserialize, Serialize};

/// Category weight configuration.
#[derive(Debug, Clone, Copy)]
pub struct CategoryWeight {
    pub category: RuleCategory,
    pub weight: f64,
}

/// Default category weights (sums to 100%).
pub const DEFAULT_WEIGHTS: &[CategoryWeight] = &[
    CategoryWeight { category: RuleCategory::Crawlability, weight: 25.0 },
    CategoryWeight { category: RuleCategory::Indexability, weight: 20.0 },
    CategoryWeight { category: RuleCategory::Metadata, weight: 15.0 },
    CategoryWeight { category: RuleCategory::StructuredData, weight: 15.0 },
    CategoryWeight { category: RuleCategory::InternalLinks, weight: 15.0 },
    CategoryWeight { category: RuleCategory::Robots, weight: 10.0 },
];

/// Scoring result for a single category.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryScore {
    pub category: RuleCategory,
    pub score: u8,
    pub weight: f64,
    pub rules_passed: u32,
    pub rules_failed: u32,
    pub rules_unavailable: u32,
    pub coverage: f64,
}

/// Overall readiness score.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadinessScore {
    pub overall_score: u8,
    pub category_scores: Vec<CategoryScore>,
    pub confidence: u8,
    pub rules_evaluated: u32,
    pub rules_passed: u32,
    pub rules_failed: u32,
    pub rules_unavailable: u32,
    pub methodology_version: &'static str,
    pub limitations: Vec<String>,
}

/// Calculate scores from rule results.
pub fn calculate_score(
    results: &[RuleResult],
    weights: &[CategoryWeight],
) -> ReadinessScore {
    let mut category_results: std::collections::HashMap<RuleCategory, Vec<&RuleResult>> =
        std::collections::HashMap::new();
    for result in results {
        category_results.entry(result.category).or_default().push(result);
    }

    let mut category_scores = Vec::new();
    let mut total_weighted = 0.0;
    let mut total_weight = 0.0;
    let mut total_passed = 0u32;
    let mut total_failed = 0u32;
    let mut total_unavailable = 0u32;
    let mut limitations = Vec::new();

    for weight in weights {
        let cat_results = category_results.get(&weight.category).cloned().unwrap_or_default();
        let passed = cat_results.iter().filter(|r| r.status == RuleStatus::Pass).count() as u32;
        let failed = cat_results.iter().filter(|r| r.status == RuleStatus::Fail).count() as u32;
        let unavailable = cat_results.iter().filter(|r| r.status == RuleStatus::Unavailable).count() as u32;
        let total_cat = cat_results.len() as u32;

        let coverage = if total_cat > 0 {
            (passed + failed) as f64 / total_cat as f64
        } else {
            0.0
        };

        // Category score: passed / (passed + failed), weighted by coverage
        let cat_score = if passed + failed > 0 {
            (passed as f64 / (passed + failed) as f64 * 100.0) as u8
        } else {
            0
        };

        let weighted = cat_score as f64 * weight.weight / 100.0 * coverage;
        total_weighted += weighted;
        total_weight += weight.weight;

        total_passed += passed;
        total_failed += failed;
        total_unavailable += unavailable;

        if coverage < 1.0 {
            limitations.push(format!("Partial coverage for {} category", weight.category.as_str()));
        }

        category_scores.push(CategoryScore {
            category: weight.category,
            score: cat_score,
            weight: weight.weight,
            rules_passed: passed,
            rules_failed: failed,
            rules_unavailable: unavailable,
            coverage,
        });
    }

    let overall_score = if total_weight > 0.0 {
        (total_weighted / total_weight * 100.0).round().clamp(0.0, 100.0) as u8
    } else {
        0
    };

    let total_rules = total_passed + total_failed + total_unavailable;
    let confidence = if total_rules > 0 {
        ((total_passed + total_failed) as f64 / total_rules as f64 * 100.0).round() as u8
    } else {
        0
    };

    if total_unavailable > 0 {
        limitations.push(format!("{total_unavailable} rule(s) could not be evaluated due to missing data"));
    }

    ReadinessScore {
        overall_score,
        category_scores,
        confidence,
        rules_evaluated: total_rules,
        rules_passed: total_passed,
        rules_failed: total_failed,
        rules_unavailable: total_unavailable,
        methodology_version: "1.0.0",
        limitations,
    }
}

/// Opportunity generation from failed findings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Opportunity {
    pub title: String,
    pub explanation: String,
    pub category: RuleCategory,
    pub severity: Severity,
    pub priority: String,
    pub estimated_effort: String,
    pub confidence: f64,
    pub status: String,
    pub affected_urls: Vec<String>,
    pub related_finding_codes: Vec<String>,
    pub suggested_fix: Option<String>,
}

/// Generate opportunities from rule results.
pub fn generate_opportunities(results: &[RuleResult]) -> Vec<Opportunity> {
    let mut opportunities = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for result in results {
        if result.status != RuleStatus::Fail {
            continue;
        }
        let severity = match result.severity {
            Some(s) => s,
            None => continue,
        };
        let priority = match severity {
            Severity::Critical => "critical",
            Severity::High => "high",
            Severity::Medium => "medium",
            Severity::Low => "low",
            Severity::Info => "low",
        };
        let effort = match severity {
            Severity::Critical | Severity::High => "large",
            Severity::Medium => "medium",
            Severity::Low | Severity::Info => "small",
        };

        let dedup_key = format!("{}:{}", result.rule_id, result.message);
        if seen.contains(&dedup_key) {
            continue;
        }
        seen.insert(dedup_key);

        let affected_urls: Vec<String> = result.findings.iter()
            .filter_map(|f| f.affected_url.clone())
            .collect();

        let related_codes: Vec<String> = result.findings.iter()
            .map(|f| f.rule_id.clone())
            .collect();

        opportunities.push(Opportunity {
            title: result.message.clone(),
            explanation: result.explanation.clone().unwrap_or_else(|| result.message.clone()),
            category: result.category,
            severity,
            priority: priority.to_owned(),
            estimated_effort: effort.to_owned(),
            confidence: result.confidence,
            status: "open".to_owned(),
            affected_urls,
            related_finding_codes: related_codes,
            suggested_fix: result.recommended_fix.clone(),
        });
    }

    // Sort by priority (critical first)
    opportunities.sort_by(|a, b| {
        let order = |p: &str| match p {
            "critical" => 0,
            "high" => 1,
            "medium" => 2,
            _ => 3,
        };
        order(&a.priority).cmp(&order(&b.priority))
    });

    opportunities
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::*;
    use crate::rules::*;

    fn make_result(rule_id: &'static str, category: RuleCategory, status: RuleStatus, severity: Option<Severity>) -> RuleResult {
        RuleResult {
            rule_id: rule_id.to_owned(),
            rule_version: 1,
            category,
            status,
            severity,
            confidence: 0.9,
            penalty_contribution: 0.0,
            message: "Test finding".into(),
            explanation: None,
            recommended_fix: None,
            evidence: serde_json::json!({}),
            findings: Vec::new(),
        }
    }

    #[test]
    fn score_all_pass() {
        let results = vec![
            make_result("crawlability.http_status_ok", RuleCategory::Crawlability, RuleStatus::Pass, None),
            make_result("robots.txt_available", RuleCategory::Robots, RuleStatus::Pass, None),
        ];
        let score = calculate_score(&results, DEFAULT_WEIGHTS);
        assert_eq!(score.overall_score, 100);
        assert_eq!(score.confidence, 100);
    }

    #[test]
    fn score_all_fail() {
        let results = vec![
            make_result("crawlability.http_status_ok", RuleCategory::Crawlability, RuleStatus::Fail, Some(Severity::High)),
            make_result("robots.txt_available", RuleCategory::Robots, RuleStatus::Fail, Some(Severity::Medium)),
        ];
        let score = calculate_score(&results, DEFAULT_WEIGHTS);
        assert_eq!(score.overall_score, 0);
        assert_eq!(score.rules_failed, 2);
    }

    #[test]
    fn generate_opportunities_only_fails() {
        let results = vec![
            make_result("crawlability.http_status_ok", RuleCategory::Crawlability, RuleStatus::Fail, Some(Severity::High)),
            make_result("metadata.title_present", RuleCategory::Metadata, RuleStatus::Pass, None),
        ];
        let opps = generate_opportunities(&results);
        assert_eq!(opps.len(), 1);
        assert_eq!(opps[0].priority, "high");
    }

    #[test]
    fn score_with_unavailable() {
        let results = vec![
            make_result("crawlability.http_status_ok", RuleCategory::Crawlability, RuleStatus::Unavailable, None),
        ];
        let score = calculate_score(&results, DEFAULT_WEIGHTS);
        assert_eq!(score.overall_score, 0);
        assert_eq!(score.rules_unavailable, 1);
        assert!(!score.limitations.is_empty());
    }
}
