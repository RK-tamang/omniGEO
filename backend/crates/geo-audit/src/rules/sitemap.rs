//! Sitemap, metadata, and indexability rules.

use crate::domain::{AuditContext, AuditRule, RuleCategory, RuleResult, Severity};
use crate::rules::{fail, make_finding, pass, warning, unavailable};
use crate::RuleStatus;

const VERSION: u32 = 1;

/// Sitemap availability check.
pub struct SitemapAvailableRule;

impl AuditRule for SitemapAvailableRule {
    fn id(&self) -> &'static str { "sitemap.available" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Sitemap }
    fn description(&self) -> &'static str { "A sitemap is available and parseable." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        if ctx.sitemap_urls.is_empty() {
            return warning(self.id(), self.version(), self.category(),
                "No sitemap URLs discovered", serde_json::json!({}));
        }
        pass(self.id(), self.version(), self.category(),
            format!("{} sitemap URL(s) discovered", ctx.sitemap_urls.len()))
    }
}

/// Sitemap/canonical mismatch check.
pub struct SitemapCanonicalRule;

impl AuditRule for SitemapCanonicalRule {
    fn id(&self) -> &'static str { "sitemap.canonical_match" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Sitemap }
    fn description(&self) -> &'static str { "Sitemap URLs match canonical URLs." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        let canonical = match &ctx.canonical_url {
            Some(c) => c.clone(),
            None => return unavailable(self.id(), self.version(), self.category(), "No canonical URL observed."),
        };
        let in_sitemap = ctx.sitemap_urls.iter().any(|u| u == &canonical);
        if in_sitemap || ctx.sitemap_urls.is_empty() {
            pass(self.id(), self.version(), self.category(), "Canonical URL is in sitemap or no sitemap data")
        } else {
            warning(self.id(), self.version(), self.category(),
                "Canonical URL not found in sitemap", serde_json::json!({"canonical": canonical}))
        }
    }
}

/// Missing page title check.
pub struct TitlePresentRule;

impl AuditRule for TitlePresentRule {
    fn id(&self) -> &'static str { "metadata.title_present" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Metadata }
    fn description(&self) -> &'static str { "Page has a non-empty title." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        match &ctx.title {
            Some(t) if !t.trim().is_empty() => pass(self.id(), self.version(), self.category(), "Title present"),
            _ => {
                let finding = crate::rules::make_finding(
                    self.id(), self.version(), self.category(), RuleStatus::Fail, Severity::Medium,
                    Some(ctx.requested_url.clone()), None,
                    serde_json::json!({"url": ctx.requested_url}),
                    "Missing page title",
                    Some("The page has no title element.".to_string()),
                    Some("Add a descriptive, page-specific title.".into()),
                    0.9,
                );
                fail(self.id(), self.version(), self.category(), Severity::Medium,
                    "Missing page title", serde_json::json!({}), Some(finding))
            }
        }
    }
}

/// Meta description check.
pub struct MetaDescriptionRule;

impl AuditRule for MetaDescriptionRule {
    fn id(&self) -> &'static str { "metadata.description_present" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Metadata }
    fn description(&self) -> &'static str { "Page has a meta description." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        match &ctx.meta_description {
            Some(d) if !d.trim().is_empty() => pass(self.id(), self.version(), self.category(), "Meta description present"),
            _ => warning(self.id(), self.version(), self.category(),
                "Missing meta description", serde_json::json!({"url": ctx.requested_url})),
        }
    }
}

/// Canonical tag check.
pub struct CanonicalPresentRule;

impl AuditRule for CanonicalPresentRule {
    fn id(&self) -> &'static str { "metadata.canonical_present" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Metadata }
    fn description(&self) -> &'static str { "Page declares a canonical URL." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        match &ctx.canonical_url {
            Some(_) => pass(self.id(), self.version(), self.category(), "Canonical URL declared"),
            None => warning(self.id(), self.version(), self.category(),
                "No canonical URL", serde_json::json!({"url": ctx.requested_url})),
        }
    }
}

/// Language declaration check.
pub struct LanguageDeclaredRule;

impl AuditRule for LanguageDeclaredRule {
    fn id(&self) -> &'static str { "metadata.language_declared" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Metadata }
    fn description(&self) -> &'static str { "Page declares a language." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        match &ctx.language {
            Some(_) => pass(self.id(), self.version(), self.category(), "Language declared"),
            None => warning(self.id(), self.version(), self.category(),
                "No language declared", serde_json::json!({"url": ctx.requested_url})),
        }
    }
}

/// Indexability: noindex check.
pub struct IndexabilityNoindexRule;

impl AuditRule for IndexabilityNoindexRule {
    fn id(&self) -> &'static str { "indexability.noindex" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Indexability }
    fn description(&self) -> &'static str { "Page is not explicitly noindexed." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        let robots_meta = ctx.meta_robots.as_deref().unwrap_or("");
        let x_robots = ctx.x_robots_tag.as_deref().unwrap_or("");
        let noindex = robots_meta.split(',').any(|d| d.trim() == "noindex")
            || x_robots.split(',').any(|d| d.trim() == "noindex");
        if noindex {
            let finding = crate::rules::make_finding(
                self.id(), self.version(), self.category(), RuleStatus::Fail, Severity::High,
                Some(ctx.requested_url.clone()), None,
                serde_json::json!({"meta_robots": robots_meta, "x_robots_tag": x_robots}),
                "Page is noindexed",
                Some("The page carries a noindex directive.".to_string()),
                Some("Remove noindex if the page should appear in search results.".into()),
                0.95,
            );
            return fail(self.id(), self.version(), self.category(), Severity::High,
                "Page is noindexed", serde_json::json!({"noindex": true}), Some(finding));
        }
        pass(self.id(), self.version(), self.category(), "Not noindexed")
    }
}

/// Indexability: error status means unavailable.
pub struct IndexabilityAvailableRule;

impl AuditRule for IndexabilityAvailableRule {
    fn id(&self) -> &'static str { "indexability.page_available" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Indexability }
    fn description(&self) -> &'static str { "Page returns a successful status and is potentially indexable." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        let status = match ctx.http_status {
            Some(s) => s,
            None => return unavailable(self.id(), self.version(), self.category(), "No HTTP status observed."),
        };
        if status >= 200 && status < 300 {
            pass(self.id(), self.version(), self.category(), format!("HTTP {status} - potentially indexable"))
        } else if status >= 400 {
            warning(self.id(), self.version(), self.category(),
                format!("HTTP {status} - page unavailable"), serde_json::json!({"status": status}))
        } else {
            pass(self.id(), self.version(), self.category(), format!("HTTP {status}"))
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
            canonical_url: Some("https://example.com/page".to_owned()),
            http_status: Some(200),
            content_type: Some("text/html".to_owned()),
            title: Some("Test Page".to_owned()),
            meta_description: Some("A test page".to_owned()),
            meta_robots: None,
            x_robots_tag: None,
            language: Some("en".to_owned()),
            viewport: None,
            open_graph: serde_json::json!({}),
            headings: Vec::new(),
            main_text: String::new(),
            word_count: 0,
            links: Vec::new(),
            images: Vec::new(),
            structured_data: Vec::new(),
            robots_document: None,
            sitemap_urls: vec!["https://example.com/page".to_owned()],
            crawl_depth: 0,
            redirect_chain: Vec::new(),
            content_hash: None,
        }
    }

    #[tokio::test]
    async fn sitemap_available() {
        let rule = SitemapAvailableRule;
        let result = rule.evaluate(&ctx());
        assert_eq!(result.status, RuleStatus::Pass);
    }

    #[tokio::test]
    async fn title_present() {
        let rule = TitlePresentRule;
        let result = rule.evaluate(&ctx());
        assert_eq!(result.status, RuleStatus::Pass);
    }

    #[tokio::test]
    async fn noindex_detected() {
        let mut c = ctx();
        c.meta_robots = Some("noindex".to_owned());
        let rule = IndexabilityNoindexRule;
        let result = rule.evaluate(&c);
        assert_eq!(result.status, RuleStatus::Fail);
        assert_eq!(result.severity, Some(Severity::High));
    }

    #[tokio::test]
    async fn language_declared() {
        let rule = LanguageDeclaredRule;
        let result = rule.evaluate(&ctx());
        assert_eq!(result.status, RuleStatus::Pass);
    }
}


