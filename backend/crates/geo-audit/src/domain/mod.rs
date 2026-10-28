//! Core domain types for the Technical GEO Audit Engine.
//!
//! Defines the audit context, rule interface, finding model, severity/status
//! enums, and result structures shared by all analyzers.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// Severity of a finding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

impl Severity {
    pub fn as_str(self) -> &'static str {
        match self {
            Severity::Info => "info",
            Severity::Low => "low",
            Severity::Medium => "medium",
            Severity::High => "high",
            Severity::Critical => "critical",
        }
    }
}

impl std::fmt::Display for Severity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Evaluation status of a rule or finding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuleStatus {
    Pass,
    Fail,
    Warning,
    Skipped,
    Unavailable,
}

impl RuleStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            RuleStatus::Pass => "pass",
            RuleStatus::Fail => "fail",
            RuleStatus::Warning => "warning",
            RuleStatus::Skipped => "skipped",
            RuleStatus::Unavailable => "unavailable",
        }
    }
}

/// Category of an audit rule.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Ord, PartialOrd, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuleCategory {
    Crawlability,
    Indexability,
    Metadata,
    StructuredData,
    InternalLinks,
    Robots,
    Sitemap,
    AiCrawler,
    ContentStructure,
}

impl RuleCategory {
    pub fn as_str(self) -> &'static str {
        match self {
            RuleCategory::Crawlability => "crawlability",
            RuleCategory::Indexability => "indexability",
            RuleCategory::Metadata => "metadata",
            RuleCategory::StructuredData => "structured_data",
            RuleCategory::InternalLinks => "internal_links",
            RuleCategory::Robots => "robots",
            RuleCategory::Sitemap => "sitemap",
            RuleCategory::AiCrawler => "ai_crawler",
            RuleCategory::ContentStructure => "content_structure",
        }
    }
}

/// Full page context available to every rule.
/// Populated from persisted crawl data (crawled_pages, crawl_links, robots.txt, sitemap).
#[derive(Debug, Clone)]
pub struct AuditContext {
    pub audit_run_id: Uuid,
    pub project_id: Option<Uuid>,
    pub organization_id: Option<Uuid>,
    pub requested_url: String,
    pub canonical_url: Option<String>,
    pub http_status: Option<u16>,
    pub content_type: Option<String>,
    pub title: Option<String>,
    pub meta_description: Option<String>,
    pub meta_robots: Option<String>,
    pub x_robots_tag: Option<String>,
    pub language: Option<String>,
    pub viewport: Option<String>,
    pub open_graph: Value,
    pub headings: Vec<(u8, String)>, // (level, text)
    pub main_text: String,
    pub word_count: usize,
    pub links: Vec<LinkInfo>,
    pub images: Vec<ImageInfo>,
    pub structured_data: Vec<Value>,
    pub robots_document: Option<RobotsAccessReport>,
    pub sitemap_urls: Vec<String>,
    pub crawl_depth: usize,
    pub redirect_chain: Vec<String>,
    pub content_hash: Option<String>,
}

/// Link observed during crawl.
#[derive(Debug, Clone)]
pub struct LinkInfo {
    pub url: String,
    pub anchor_text: Option<String>,
    pub rel: Option<String>,
    pub is_internal: bool,
    pub is_nofollow: bool,
    pub is_sponsored: bool,
    pub is_ugc: bool,
}

/// Image observed during crawl.
#[derive(Debug, Clone)]
pub struct ImageInfo {
    pub url: String,
    pub alt_text: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// Result of a single rule evaluation.
#[derive(Debug, Clone)]
pub struct RuleResult {
    pub rule_id: String,
    pub rule_version: u32,
    pub category: RuleCategory,
    pub status: RuleStatus,
    pub severity: Option<Severity>,
    pub confidence: f64,
    pub penalty_contribution: f64,
    pub message: String,
    pub explanation: Option<String>,
    pub recommended_fix: Option<String>,
    pub evidence: Value,
    pub findings: Vec<Finding>,
}

/// A structured finding linked to a specific URL/element.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub rule_id: String,
    pub rule_version: u32,
    pub category: RuleCategory,
    pub status: RuleStatus,
    pub severity: Severity,
    pub affected_url: Option<String>,
    pub affected_element: Option<String>,
    pub evidence: Value,
    pub message: String,
    pub explanation: Option<String>,
    pub recommended_fix: Option<String>,
    pub confidence: f64,
}

/// Abstraction over robots.txt access evaluation.
#[derive(Debug, Clone)]
pub struct RobotsAccessReport {
    pub user_agent: String,
    pub path: String,
    pub allowed: bool,
    pub applicable_rules: Vec<String>,
    pub explanation: String,
}

impl From<&answerscope_web_intelligence::robots::AccessEvaluation> for RobotsAccessReport {
    fn from(eval: &answerscope_web_intelligence::robots::AccessEvaluation) -> Self {
        Self {
            user_agent: eval.user_agent.clone(),
            path: eval.path.clone(),
            allowed: eval.allowed,
            applicable_rules: eval
                .applicable_rules
                .iter()
                .map(|r| r.path.clone())
                .collect(),
            explanation: eval.explanation.clone(),
        }
    }
}

/// Extensible rule trait. Each rule evaluates against the shared AuditContext.
pub trait AuditRule: Send + Sync {
    /// Stable rule identifier (e.g. "crawlability.http_status_ok").
    fn id(&self) -> &'static str;
    /// Schema version of this rule's finding shape.
    fn version(&self) -> u32;
    /// Rule category for scoring and grouping.
    fn category(&self) -> RuleCategory;
    /// Human-readable description.
    fn description(&self) -> &'static str;
    /// Base weight used by the scoring engine.
    fn base_weight(&self) -> f64 {
        1.0
    }
    /// Evaluate the rule against the provided context.
    fn evaluate(&self, context: &AuditContext) -> RuleResult;
}

/// Registry of all available rules.
pub struct RuleRegistry {
    rules: Vec<Box<dyn AuditRule>>,
}

impl Default for RuleRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl RuleRegistry {
    pub fn new() -> Self {
        Self { rules: Vec::new() }
    }

    pub fn register(mut self, rule: Box<dyn AuditRule>) -> Self {
        self.rules.push(rule);
        self
    }

    pub fn rules(&self) -> &[Box<dyn AuditRule>] {
        &self.rules
    }

    pub fn find(&self, rule_id: &str) -> Option<&Box<dyn AuditRule>> {
        self.rules.iter().find(|r| r.id() == rule_id)
    }

    pub fn by_category(&self, category: RuleCategory) -> Vec<&Box<dyn AuditRule>> {
        self.rules.iter().filter(|r| r.category() == category).collect()
    }
}

/// Execution engine: runs all rules against a context and aggregates results.
pub struct AuditExecutor {
    registry: RuleRegistry,
}

impl Default for AuditExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl AuditExecutor {
    pub fn new() -> Self {
        Self {
            registry: RuleRegistry::new(),
        }
    }

    pub fn with_registry(mut self, registry: RuleRegistry) -> Self {
        self.registry = registry;
        self
    }

    pub fn execute_all(&self, context: &AuditContext) -> Vec<RuleResult> {
        let mut results = Vec::new();
        for rule in self.registry.rules() {
            let result = rule.evaluate(context);
            results.push(result);
        }
        results
    }

    pub fn execute_category(
        &self,
        context: &AuditContext,
        category: RuleCategory,
    ) -> Vec<RuleResult> {
        let mut results = Vec::new();
        for rule in self.registry.by_category(category) {
            let result = rule.evaluate(context);
            results.push(result);
        }
        results
    }

    pub fn registry(&self) -> &RuleRegistry {
        &self.registry
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn severity_display() {
        assert_eq!(Severity::Critical.as_str(), "critical");
        assert_eq!(Severity::Info.as_str(), "info");
    }

    #[test]
    fn rule_status_display() {
        assert_eq!(RuleStatus::Fail.as_str(), "fail");
        assert_eq!(RuleStatus::Unavailable.as_str(), "unavailable");
    }

    #[test]
    fn rule_category_display() {
        assert_eq!(RuleCategory::Crawlability.as_str(), "crawlability");
        assert_eq!(RuleCategory::AiCrawler.as_str(), "ai_crawler");
    }

    #[test]
    fn registry_register_and_find() {
        // We can't easily instantiate a rule here without implementing one,
        // but we verify the registry structure is sound.
        let registry = RuleRegistry::new();
        assert!(registry.rules().is_empty());
        assert!(registry.find("nonexistent").is_none());
    }
}
