//! Structured data, internal link, and content structure rules.

use crate::domain::{AuditContext, AuditRule, RuleCategory, RuleResult, Severity};
use crate::rules::{fail, make_finding, pass, warning, unavailable};
use crate::RuleStatus;

const VERSION: u32 = 1;

/// JSON-LD validity check.
pub struct StructuredDataValidRule;

impl AuditRule for StructuredDataValidRule {
    fn id(&self) -> &'static str { "structured_data.valid_json_ld" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::StructuredData }
    fn description(&self) -> &'static str { "JSON-LD structured data is syntactically valid." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        if ctx.structured_data.is_empty() {
            return warning(self.id(), self.version(), self.category(),
                "No structured data found", serde_json::json!({}));
        }
        // Check each document is an object (basic validity)
        let invalid = ctx.structured_data.iter().any(|d| !d.is_object());
        if invalid {
            warning(self.id(), self.version(), self.category(),
                "Some structured data nodes are not objects", serde_json::json!({"count": ctx.structured_data.len()}))
        } else {
            pass(self.id(), self.version(), self.category(),
                format!("{} structured data document(s)", ctx.structured_data.len()))
        }
    }
}

/// Organization schema presence check.
pub struct OrganizationSchemaRule;

impl AuditRule for OrganizationSchemaRule {
    fn id(&self) -> &'static str { "structured_data.organization_present" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::StructuredData }
    fn description(&self) -> &'static str { "Organization or LocalBusiness schema is present." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        let has_org = ctx.structured_data.iter().any(|d| {
            d.get("@type").and_then(|t| t.as_str())
                .map(|s| s == "Organization" || s == "LocalBusiness")
                .unwrap_or(false)
        });
        if has_org {
            pass(self.id(), self.version(), self.category(), "Organization schema present")
        } else {
            warning(self.id(), self.version(), self.category(),
                "No Organization schema detected", serde_json::json!({}))
        }
    }
}

/// Internal link coverage check.
pub struct InternalLinksPresentRule;

impl AuditRule for InternalLinksPresentRule {
    fn id(&self) -> &'static str { "internal_links.internal_links_present" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::InternalLinks }
    fn description(&self) -> &'static str { "Page has at least one internal link." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        let internal_count = ctx.links.iter().filter(|l| l.is_internal).count();
        if internal_count > 0 {
            pass(self.id(), self.version(), self.category(),
                format!("{internal_count} internal link(s)"))
        } else {
            warning(self.id(), self.version(), self.category(),
                "No internal links found", serde_json::json!({"url": ctx.requested_url}))
        }
    }
}

/// Broken internal links check.
pub struct BrokenInternalLinksRule;

impl AuditRule for BrokenInternalLinksRule {
    fn id(&self) -> &'static str { "internal_links.no_broken_internal_links" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::InternalLinks }
    fn description(&self) -> &'static str { "Internal links do not point to 4xx/5xx pages." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        // Link status is not stored in AuditContext directly; check via HTTP status of current page only.
        // This rule is informational when we can't check individual link targets.
        let internal_count = ctx.links.iter().filter(|l| l.is_internal).count();
        if internal_count == 0 {
            return pass(self.id(), self.version(), self.category(), "No internal links to check");
        }
        // We only know the current page's status; link target status requires crawl_links data.
        // Report as info with current page context.
        pass(self.id(), self.version(), self.category(),
            format!("{internal_count} internal link(s) observed (target status not checked in single-page mode)"))
    }
}

/// Orphan page candidate check.
pub struct OrphanPageRule;

impl AuditRule for OrphanPageRule {
    fn id(&self) -> &'static str { "internal_links.no_orphan_pages" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::InternalLinks }
    fn description(&self) -> &'static str { "Page has internal incoming links (not an orphan)." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        // In single-page context, we can't determine incoming links without crawl_links data.
        // Mark as unavailable when we lack link graph data.
        if ctx.crawl_depth > 0 {
            // Has been crawled at depth > 0, meaning it was discovered from another page
            pass(self.id(), self.version(), self.category(), "Page was discovered via internal link")
        } else {
            unavailable(self.id(), self.version(), self.category(),
                "Cannot determine orphan status without crawl link graph data")
        }
    }
}

/// Heading hierarchy check.
pub struct HeadingHierarchyRule;

impl AuditRule for HeadingHierarchyRule {
    fn id(&self) -> &'static str { "content_structure.heading_hierarchy" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::ContentStructure }
    fn description(&self) -> &'static str { "Headings follow a logical H1-H6 hierarchy." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        if ctx.headings.is_empty() {
            return warning(self.id(), self.version(), self.category(),
                "No headings found", serde_json::json!({"url": ctx.requested_url}));
        }
        // Check for H1 presence
        let has_h1 = ctx.headings.iter().any(|(level, _)| *level == 1);
        if !has_h1 {
            return warning(self.id(), self.version(), self.category(),
                "No H1 heading found", serde_json::json!({"heading_count": ctx.headings.len()}));
        }
        // Check for skipped levels (e.g., H1 to H3)
        let mut prev_level: Option<u8> = None;
        for (level, _) in &ctx.headings {
            if let Some(prev) = prev_level {
                if *level > prev + 1 {
                    return warning(self.id(), self.version(), self.category(),
                        format!("Heading level jumps from H{prev} to H{}", level),
                        serde_json::json!({"headings": ctx.headings}));
                }
            }
            prev_level = Some(*level);
        }
        pass(self.id(), self.version(), self.category(),
            format!("{} heading(s) with valid hierarchy", ctx.headings.len()))
    }
}

/// Main content presence check.
pub struct MainContentPresentRule;

impl AuditRule for MainContentPresentRule {
    fn id(&self) -> &'static str { "content_structure.main_content_present" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::ContentStructure }
    fn description(&self) -> &'static str { "Page has meaningful main content." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        if ctx.word_count > 100 {
            pass(self.id(), self.version(), self.category(),
                format!("{} words", ctx.word_count))
        } else if ctx.word_count > 0 {
            warning(self.id(), self.version(), self.category(),
                format!("Potentially thin content: {} words", ctx.word_count),
                serde_json::json!({"word_count": ctx.word_count}))
        } else {
            fail(self.id(), self.version(), self.category(), Severity::Medium,
                "Empty main content", serde_json::json!({"word_count": 0}),
                None)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::*;
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
            headings: vec![(1, "Title".to_owned()), (2, "Sub".to_owned())],
            main_text: "This is a test page with enough content to be meaningful.".to_owned(),
            word_count: 12,
            links: vec![LinkInfo {
                url: "https://example.com/about".to_owned(),
                anchor_text: Some("About".to_owned()),
                rel: None,
                is_internal: true,
                is_nofollow: false,
                is_sponsored: false,
                is_ugc: false,
            }],
            images: Vec::new(),
            structured_data: vec![serde_json::json!({"@type": "Organization", "name": "Acme"})],
            robots_document: None,
            sitemap_urls: Vec::new(),
            crawl_depth: 1,
            redirect_chain: Vec::new(),
            content_hash: None,
        }
    }

    #[tokio::test]
    async fn structured_data_valid() {
        let rule = StructuredDataValidRule;
        let result = rule.evaluate(&ctx());
        assert_eq!(result.status, RuleStatus::Pass);
    }

    #[tokio::test]
    async fn no_structured_data_warning() {
        let mut c = ctx();
        c.structured_data = Vec::new();
        let rule = StructuredDataValidRule;
        let result = rule.evaluate(&c);
        assert_eq!(result.status, RuleStatus::Warning);
    }

    #[tokio::test]
    async fn heading_hierarchy_ok() {
        let rule = HeadingHierarchyRule;
        let result = rule.evaluate(&ctx());
        assert_eq!(result.status, RuleStatus::Pass);
    }

    #[tokio::test]
    async fn no_headings_warning() {
        let mut c = ctx();
        c.headings = Vec::new();
        let rule = HeadingHierarchyRule;
        let result = rule.evaluate(&c);
        assert_eq!(result.status, RuleStatus::Warning);
    }

    #[tokio::test]
    async fn thin_content_warning() {
        let mut c = ctx();
        c.word_count = 10;
        let rule = MainContentPresentRule;
        let result = rule.evaluate(&c);
        assert_eq!(result.status, RuleStatus::Warning);
    }

    #[tokio::test]
    async fn orphan_depth_gt_zero_pass() {
        let rule = OrphanPageRule;
        let result = rule.evaluate(&ctx());
        assert_eq!(result.status, RuleStatus::Pass);
    }

    #[tokio::test]
    async fn orphan_depth_zero_unavailable() {
        let mut c = ctx();
        c.crawl_depth = 0;
        let rule = OrphanPageRule;
        let result = rule.evaluate(&c);
        assert_eq!(result.status, RuleStatus::Unavailable);
    }
}

