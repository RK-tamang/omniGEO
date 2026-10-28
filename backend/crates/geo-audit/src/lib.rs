//! Evidence-based GEO audit rules, score methodology, and findings.
//!
//! Module layout:
//!   domain        - AuditContext, RuleResult, Finding, Severity, RuleStatus, AuditRule trait
//!   rules         - Individual rule implementations per category
//!   scoring       - Technical GEO readiness scoring
//!   opportunities - Opportunity generation from findings
//!   persistence   - Database storage for findings, scores, opportunities
//!   brand         - Brand entity analysis (existing)
//!   content       - Content structure analysis (existing)
//!   duplicate     - Duplicate content detection (existing)
//!   prompts       - Prompt idea generation (existing)
//!   schema        - Structured data validation (existing)

pub mod domain;
pub mod rules;
pub mod scoring;
pub mod opportunities;
pub mod persistence;

// Existing analysis modules (retained and refactored to use domain types).
pub mod brand;
pub mod content;
pub mod duplicate;
pub mod prompts;
pub mod schema;

// Re-export core types for convenience.
pub use domain::{
    AuditContext, AuditExecutor, AuditRule, Finding, LinkInfo, RuleCategory, RuleResult, RuleStatus,
    Severity,
};
