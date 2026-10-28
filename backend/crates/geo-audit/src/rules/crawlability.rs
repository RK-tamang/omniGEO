//! Crawlability rules: HTTP status, redirects, content types, URL normalization.

use crate::domain::{AuditContext, AuditRule, RuleCategory, RuleResult, Severity};
use crate::rules::{fail, is_error_status, is_important_path, is_redirect, make_finding, pass, unavailable};
use crate::RuleStatus;

const VERSION: u32 = 1;

/// HTTP status check: page returns a successful status.
pub struct HttpStatusRule;

impl AuditRule for HttpStatusRule {
    fn id(&self) -> &'static str { "crawlability.http_status_ok" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Crawlability }
    fn description(&self) -> &'static str { "Page returns a successful HTTP status (2xx)." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        let status = match ctx.http_status {
            Some(s) => s,
            None => return unavailable(self.id(), self.version(), self.category(), "No HTTP status observed."),
        };
        if status >= 200 && status < 300 {
            return pass(self.id(), self.version(), self.category(), format!("HTTP {status}"));
        }
        let severity = if status >= 500 { Severity::High } else { Severity::Medium };
        let finding = make_finding(
            self.id(), self.version(), self.category(), RuleStatus::Fail, severity,
            Some(ctx.requested_url.clone()), None,
            serde_json::json!({"status": status, "url": ctx.requested_url}),
            format!("Page returned HTTP {status}"),
            Some(format!("The server responded with status {status}, indicating a client or server error.")),
            Some("Investigate the server configuration and ensure the page returns HTTP 200.".into()),
            0.9,
        );
        fail(self.id(), self.version(), self.category(), severity, format!("HTTP {status}"), serde_json::json!({"status": status}), Some(finding))
    }
}

/// Redirect chain check: no excessive redirects.
pub struct RedirectChainRule;

impl AuditRule for RedirectChainRule {
    fn id(&self) -> &'static str { "crawlability.redirect_chain" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Crawlability }
    fn description(&self) -> &'static str { "Redirect chains are short and do not loop." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        let chain_len = ctx.redirect_chain.len();
        if chain_len == 0 {
            return pass(self.id(), self.version(), self.category(), "No redirects");
        }
        if chain_len > 3 {
            let finding = make_finding(
                self.id(), self.version(), self.category(), RuleStatus::Fail, Severity::Medium,
                Some(ctx.requested_url.clone()), None,
                serde_json::json!({"redirect_chain": ctx.redirect_chain, "chain_length": chain_len}),
                format!("Redirect chain of {chain_len} hops"),
                Some("Multiple redirects add latency and can dilute crawl budget.".to_string()),
                Some("Reduce redirect chains to a single hop where possible.".into()),
                0.85,
            );
            return fail(self.id(), self.version(), self.category(), Severity::Medium,
                format!("Redirect chain of {chain_len} hops"), serde_json::json!({"chain_length": chain_len}), Some(finding));
        }
        pass(self.id(), self.version(), self.category(), format!("{chain_len} redirect hop(s)"))
    }
}

/// Redirect loop check.
pub struct RedirectLoopRule;

impl AuditRule for RedirectLoopRule {
    fn id(&self) -> &'static str { "crawlability.redirect_loop" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Crawlability }
    fn description(&self) -> &'static str { "No redirect loops detected." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        let mut seen = std::collections::HashSet::new();
        let mut looped = false;
        for url in &ctx.redirect_chain {
            if !seen.insert(url.clone()) {
                looped = true;
                break;
            }
        }
        if looped {
            let finding = make_finding(
                self.id(), self.version(), self.category(), RuleStatus::Fail, Severity::Critical,
                Some(ctx.requested_url.clone()), None,
                serde_json::json!({"redirect_chain": ctx.redirect_chain}),
                "Redirect loop detected",
                Some("The page redirects in a cycle, making it unreachable.".to_string()),
                Some("Fix the redirect configuration to eliminate the loop.".into()),
                0.95,
            );
            return fail(self.id(), self.version(), self.category(), Severity::Critical,
                "Redirect loop detected", serde_json::json!({}), Some(finding));
        }
        pass(self.id(), self.version(), self.category(), "No redirect loop")
    }
}

/// Content type check: HTML pages return text/html.
pub struct ContentTypeRule;

impl AuditRule for ContentTypeRule {
    fn id(&self) -> &'static str { "crawlability.content_type_html" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Crawlability }
    fn description(&self) -> &'static str { "HTML pages are served with text/html content type." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        let ct = match &ctx.content_type {
            Some(c) => c.clone(),
            None => return unavailable(self.id(), self.version(), self.category(), "No content type observed."),
        };
        if ct.contains("text/html") {
            return pass(self.id(), self.version(), self.category(), format!("Content-Type: {ct}"));
        }
        let finding = make_finding(
            self.id(), self.version(), self.category(), RuleStatus::Fail, Severity::Medium,
            Some(ctx.requested_url.clone()), None,
            serde_json::json!({"content_type": ct}),
            format!("Unexpected content type: {ct}"),
            Some("The page is not served as HTML, limiting content extraction.".to_string()),
            Some("Serve HTML pages with Content-Type: text/html.".into()),
            0.8,
        );
        fail(self.id(), self.version(), self.category(), Severity::Medium,
            format!("Unexpected content type: {ct}"), serde_json::json!({"content_type": ct}), Some(finding))
    }
}

/// Important pages must not return 4xx/5xx.
pub struct ImportantPagesStatusRule;

impl AuditRule for ImportantPagesStatusRule {
    fn id(&self) -> &'static str { "crawlability.important_pages_status" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Crawlability }
    fn description(&self) -> &'static str { "Important site pages (about, contact, services) return successful status." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        if !is_important_path(&ctx.requested_url) {
            return pass(self.id(), self.version(), self.category(), "Not an important page path");
        }
        let status = match ctx.http_status {
            Some(s) => s,
            None => return unavailable(self.id(), self.version(), self.category(), "No HTTP status observed."),
        };
        if is_error_status(status) {
            let finding = make_finding(
                self.id(), self.version(), self.category(), RuleStatus::Fail, Severity::High,
                Some(ctx.requested_url.clone()), None,
                serde_json::json!({"status": status, "url": ctx.requested_url}),
                format!("Important page returned HTTP {status}"),
                Some("An important site page is returning an error status.".to_string()),
                Some("Restore the page or return a proper 404 with a helpful error page.".into()),
                0.9,
            );
            return fail(self.id(), self.version(), self.category(), Severity::High,
                format!("Important page returned HTTP {status}"), serde_json::json!({"status": status}), Some(finding));
        }
        pass(self.id(), self.version(), self.category(), format!("Important page HTTP {status}"))
    }
}

/// URL normalization check: no conflicting URL variants.
pub struct UrlNormalizationRule;

impl AuditRule for UrlNormalizationRule {
    fn id(&self) -> &'static str { "crawlability.url_normalization" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Crawlability }
    fn description(&self) -> &'static str { "URLs are consistently normalized (trailing slashes, case)." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        let requested = &ctx.requested_url;
        let canonical = ctx.canonical_url.as_deref().unwrap_or(requested);
        if requested == canonical {
            return pass(self.id(), self.version(), self.category(), "URL matches canonical");
        }
        let finding = make_finding(
            self.id(), self.version(), self.category(), RuleStatus::Warning, Severity::Low,
            Some(requested.clone()), None,
            serde_json::json!({"requested": requested, "canonical": canonical}),
            "Requested URL differs from canonical URL",
            Some("The requested URL and canonical URL differ, which may cause duplicate content issues.".to_string()),
            Some("Ensure consistent URL canonicalization across the site.".into()),
            0.7,
        );
        fail(self.id(), self.version(), self.category(), Severity::Low,
            "URL normalization mismatch", serde_json::json!({"requested": requested, "canonical": canonical}), Some(finding))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::*;

    fn ctx(status: Option<u16>, ct: Option<&str>, redirects: Vec<String>) -> AuditContext {
        AuditContext {
            audit_run_id: Uuid::new_v4(),
            project_id: None,
            organization_id: None,
            requested_url: "https://example.com/page".to_owned(),
            canonical_url: None,
            http_status: status,
            content_type: ct.map(|s| s.to_owned()),
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
            redirect_chain: redirects,
            content_hash: None,
        }
    }

    #[tokio::test]
    async fn http_status_ok() {
        let rule = HttpStatusRule;
        let ctx = ctx(Some(200), Some("text/html"), vec![]);
        let result = rule.evaluate(&ctx);
        assert_eq!(result.status, RuleStatus::Pass);
    }

    #[tokio::test]
    async fn http_status_server_error() {
        let rule = HttpStatusRule;
        let ctx = ctx(Some(500), Some("text/html"), vec![]);
        let result = rule.evaluate(&ctx);
        assert_eq!(result.status, RuleStatus::Fail);
        assert_eq!(result.severity, Some(Severity::High));
    }

    #[tokio::test]
    async fn redirect_loop_detected() {
        let rule = RedirectLoopRule;
        let ctx = ctx(Some(200), Some("text/html"), vec![
            "https://example.com/a".to_owned(),
            "https://example.com/b".to_owned(),
            "https://example.com/a".to_owned(),
        ]);
        let result = rule.evaluate(&ctx);
        assert_eq!(result.status, RuleStatus::Fail);
        assert_eq!(result.severity, Some(Severity::Critical));
    }

    #[tokio::test]
    async fn content_type_non_html() {
        let rule = ContentTypeRule;
        let ctx = ctx(Some(200), Some("application/json"), vec![]);
        let result = rule.evaluate(&ctx);
        assert_eq!(result.status, RuleStatus::Fail);
    }

    #[tokio::test]
    async fn no_status_unavailable() {
        let rule = HttpStatusRule;
        let ctx = ctx(None, None, vec![]);
        let result = rule.evaluate(&ctx);
        assert_eq!(result.status, RuleStatus::Unavailable);
    }
}


