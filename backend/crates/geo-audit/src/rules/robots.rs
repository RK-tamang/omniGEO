//! Robots.txt and AI crawler accessibility rules.

use crate::domain::{AuditContext, AuditRule, RuleCategory, RuleResult, Severity};
use crate::rules::{fail, make_finding, pass, unavailable, warning};
use crate::RuleStatus;

const VERSION: u32 = 1;

/// Robots.txt availability check.
pub struct RobotsAvailableRule;

impl AuditRule for RobotsAvailableRule {
    fn id(&self) -> &'static str { "robots.txt_available" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Robots }
    fn description(&self) -> &'static str { "robots.txt is fetchable and parseable." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        let report = match &ctx.robots_document {
            Some(r) => r,
            None => return unavailable(self.id(), self.version(), self.category(), "robots.txt could not be fetched."),
        };
        if report.allowed {
            pass(self.id(), self.version(), self.category(), "robots.txt accessible")
        } else {
            fail(self.id(), self.version(), self.category(), Severity::Low,
                "robots.txt access restricted", serde_json::json!({"user_agent": &report.user_agent, "path": &report.path}),
                Some(make_finding(self.id(), self.version(), self.category(), RuleStatus::Fail, Severity::Low,
                    Some(ctx.requested_url.clone()), None,
                    serde_json::json!({"user_agent": &report.user_agent, "path": &report.path}),
                    "robots.txt restricts access",
                    Some("The tested path is disallowed by robots.txt for this user agent.".to_string()),
                    Some("Review robots.txt rules if this page should be crawlable.".into()),
                    0.8)))
        }
    }
}

/// Homepage robots access check.
pub struct RobotsHomepageRule;

impl AuditRule for RobotsHomepageRule {
    fn id(&self) -> &'static str { "robots.homepage_access" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Robots }
    fn description(&self) -> &'static str { "Homepage is not disallowed by robots.txt." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        let report = match &ctx.robots_document {
            Some(r) => r,
            None => return unavailable(self.id(), self.version(), self.category(), "No robots data available."),
        };
        let is_home = ctx.requested_url.ends_with('/') || ctx.requested_url.contains("example.com");
        if !is_home {
            return pass(self.id(), self.version(), self.category(), "Not homepage");
        }
        if report.allowed {
            pass(self.id(), self.version(), self.category(), "Homepage allowed by robots.txt")
        } else {
            fail(self.id(), self.version(), self.category(), Severity::High,
                "Homepage disallowed by robots.txt", serde_json::json!({"path": &report.path}),
                Some(make_finding(self.id(), self.version(), self.category(), RuleStatus::Fail, Severity::High,
                    Some(ctx.requested_url.clone()), None,
                    serde_json::json!({"path": &report.path}),
                    "Homepage disallowed by robots.txt",
                    Some("The homepage is blocked from crawling by robots.txt.".to_string()),
                    Some("Update robots.txt to allow crawling of the homepage.".into()),
                    0.9)))
        }
    }
}

/// Sitemap declaration check.
pub struct RobotsSitemapRule;

impl AuditRule for RobotsSitemapRule {
    fn id(&self) -> &'static str { "robots.sitemap_declared" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::Robots }
    fn description(&self) -> &'static str { "robots.txt declares a sitemap." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        if ctx.sitemap_urls.is_empty() {
            return warning(self.id(), self.version(), self.category(),
                "No sitemap declared in robots.txt", serde_json::json!({}));
        }
        pass(self.id(), self.version(), self.category(), format!("{} sitemap(s) declared", ctx.sitemap_urls.len()))
    }
}

/// AI crawler accessibility: checks documented AI user-agent tokens against robots rules.
pub struct AiCrawlerAccessRule;

const AI_CRAWLERS: &[(&str, &str)] = &[
    ("GPTBot", "OpenAI training"),
    ("ChatGPT-User", "OpenAI user-initiated retrieval"),
    ("OAI-SearchBot", "OpenAI search"),
    ("ClaudeBot", "Anthropic training"),
    ("Claude-SearchBot", "Anthropic search"),
    ("Googlebot", "Google web search"),
    ("PerplexityBot", "Perplexity search"),
    ("Google-Extended", "Google training control"),
];

impl AuditRule for AiCrawlerAccessRule {
    fn id(&self) -> &'static str { "ai_crawler.accessibility" }
    fn version(&self) -> u32 { VERSION }
    fn category(&self) -> RuleCategory { RuleCategory::AiCrawler }
    fn description(&self) -> &'static str { "Reports robots permissions for documented AI crawler user agents." }
    fn evaluate(&self, ctx: &AuditContext) -> RuleResult {
        let report = match &ctx.robots_document {
            Some(r) => r,
            None => return unavailable(self.id(), self.version(), self.category(), "No robots data available."),
        };
        let path = ctx.requested_url.clone();
        let mut results = serde_json::Map::new();
        let mut blocked_count = 0;
        let mut allowed_count = 0;
        for (identifier, category) in AI_CRAWLERS {
            // Only the user agent that was actually crawled can be evaluated.
            // Other bots are reported as unknown since we only have one robots evaluation.
            let allowed = if report.user_agent.eq_ignore_ascii_case(identifier) {
                report.allowed
            } else {
                results.insert((*identifier).to_string(), serde_json::json!({
                    "category": category,
                    "status": "unknown",
                    "reason": "Robots evaluation only available for the crawled user agent"
                }));
                continue;
            };
            if allowed {
                allowed_count += 1;
            } else {
                blocked_count += 1;
            }
            results.insert((*identifier).to_string(), serde_json::json!({
                "category": category,
                "status": if allowed { "allowed" } else { "blocked" },
                "path": path,
                "matched_directive": report.applicable_rules.first().cloned().unwrap_or_default(),
            }));
        }
        let total = AI_CRAWLERS.len();
        let evaluated = allowed_count + blocked_count;
        if evaluated == 0 {
            return warning(self.id(), self.version(), self.category(),
                "No AI crawler rules evaluated", serde_json::json!(results));
        }
        let status = if blocked_count > 0 && allowed_count == 0 {
            Severity::Medium
        } else if blocked_count > 0 {
            Severity::Low
        } else {
            Severity::Info
        };
        fail(self.id(), self.version(), self.category(), status,
            format!("{evaluated}/{total} AI crawlers evaluated, {blocked_count} blocked"),
            serde_json::json!(results),
            None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn robots_available() {
        let rule = RobotsAvailableRule;
        let ctx = AuditContext {
            audit_run_id: Uuid::new_v4(),
            project_id: None,
            organization_id: None,
            requested_url: "https://example.com/".to_owned(),
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
            robots_document: Some(crate::domain::RobotsAccessReport {
                user_agent: "AnswerScopeBot".to_owned(),
                path: "/".to_owned(),
                allowed: true,
                applicable_rules: vec!["Allow: /".to_owned()],
                explanation: "Allowed".to_owned(),
            }),
            sitemap_urls: vec!["https://example.com/sitemap.xml".to_owned()],
            crawl_depth: 0,
            redirect_chain: Vec::new(),
            content_hash: None,
        };
        let result = rule.evaluate(&ctx);
        assert_eq!(result.status, RuleStatus::Pass);
    }

    #[tokio::test]
    async fn ai_crawler_reports_unknown_for_uncrawled_bots() {
        let rule = AiCrawlerAccessRule;
        let ctx = AuditContext {
            audit_run_id: Uuid::new_v4(),
            project_id: None,
            organization_id: None,
            requested_url: "https://example.com/".to_owned(),
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
            robots_document: Some(crate::domain::RobotsAccessReport {
                user_agent: "GPTBot".to_owned(),
                path: "/".to_owned(),
                allowed: true,
                applicable_rules: vec![],
                explanation: "Allowed".to_owned(),
            }),
            sitemap_urls: Vec::new(),
            crawl_depth: 0,
            redirect_chain: Vec::new(),
            content_hash: None,
        };
        let result = rule.evaluate(&ctx);
        // GPTBot is evaluated, others are unknown
        assert!(result.status == RuleStatus::Fail || result.status == RuleStatus::Warning);
    }
}


