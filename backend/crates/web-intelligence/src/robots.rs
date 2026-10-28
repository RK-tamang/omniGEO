//! Deterministic robots.txt parsing and path evaluation.
//! This reports access directives; it never treats permission as evidence of a crawler visit.
use std::collections::BTreeMap;

use serde::Serialize;
use url::Url;

#[derive(Debug, Clone, Serialize)]
pub struct RobotsDocument {
    pub groups: Vec<RobotsGroup>,
    pub sitemaps: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RobotsGroup {
    pub user_agents: Vec<String>,
    pub rules: Vec<RobotsRule>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RobotsRule {
    pub directive: RuleDirective,
    pub path: String,
    pub line: usize,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuleDirective {
    Allow,
    Disallow,
}

#[derive(Debug, Clone, Serialize)]
pub struct AccessEvaluation {
    pub user_agent: String,
    pub path: String,
    pub allowed: bool,
    pub applicable_rules: Vec<RobotsRule>,
    pub explanation: String,
}

impl RobotsDocument {
    pub fn parse(source: &str) -> Self {
        let mut groups = Vec::<RobotsGroup>::new();
        let mut sitemaps = Vec::new();
        let mut warnings = Vec::new();
        let mut current: Option<RobotsGroup> = None;
        let mut saw_rule = false;

        for (index, raw_line) in source.lines().enumerate() {
            let line = raw_line.split('#').next().unwrap_or_default().trim();
            if line.is_empty() {
                continue;
            }
            let Some((raw_name, raw_value)) = line.split_once(':') else {
                warnings.push(format!("Line {} is not a directive.", index + 1));
                continue;
            };
            let name = raw_name.trim().to_ascii_lowercase();
            let value = raw_value.trim();
            match name.as_str() {
                "user-agent" => {
                    if saw_rule {
                        if let Some(group) = current.take() {
                            groups.push(group);
                        }
                        saw_rule = false;
                    }
                    current
                        .get_or_insert_with(|| RobotsGroup {
                            user_agents: vec![],
                            rules: vec![],
                        })
                        .user_agents
                        .push(value.to_ascii_lowercase());
                }
                "allow" | "disallow" => {
                    let Some(group) = current.as_mut() else {
                        warnings.push(format!(
                            "Line {} has a {} directive before a user-agent.",
                            index + 1,
                            name
                        ));
                        continue;
                    };
                    saw_rule = true;
                    if value.is_empty() && name == "disallow" {
                        continue;
                    }
                    group.rules.push(RobotsRule {
                        directive: if name == "allow" {
                            RuleDirective::Allow
                        } else {
                            RuleDirective::Disallow
                        },
                        path: value.into(),
                        line: index + 1,
                    });
                }
                "sitemap" => {
                    if Url::parse(value).is_ok() {
                        sitemaps.push(value.into());
                    } else {
                        warnings.push(format!("Line {} has an invalid sitemap URL.", index + 1));
                    }
                }
                _ => {}
            }
        }
        if let Some(group) = current {
            groups.push(group);
        }
        let mut duplicate_agents = BTreeMap::<String, usize>::new();
        for group in &groups {
            for agent in &group.user_agents {
                *duplicate_agents.entry(agent.clone()).or_default() += 1;
            }
        }
        for (agent, count) in duplicate_agents {
            if count > 1 {
                warnings.push(format!("User-agent '{agent}' appears in {count} separate groups; directives may be hard to maintain."));
            }
        }
        for group in &groups {
            for (index, rule) in group.rules.iter().enumerate() {
                if group
                    .rules
                    .iter()
                    .skip(index + 1)
                    .any(|other| other.path == rule.path && other.directive != rule.directive)
                {
                    warnings.push(format!("Conflicting Allow and Disallow directives exist for '{}' in a user-agent group.", rule.path));
                }
            }
        }
        Self {
            groups,
            sitemaps,
            warnings,
        }
    }

    pub fn evaluate(&self, user_agent: &str, url_or_path: &str) -> AccessEvaluation {
        let path = Url::parse(url_or_path)
            .map(|url| {
                format!(
                    "{}{}",
                    url.path(),
                    url.query().map(|q| format!("?{q}")).unwrap_or_default()
                )
            })
            .unwrap_or_else(|_| url_or_path.to_owned());
        let ua = user_agent.to_ascii_lowercase();
        let exact: Vec<_> = self
            .groups
            .iter()
            .filter(|group| {
                group
                    .user_agents
                    .iter()
                    .any(|agent| agent != "*" && ua.contains(agent))
            })
            .collect();
        let selected: Vec<_> = if exact.is_empty() {
            self.groups
                .iter()
                .filter(|group| group.user_agents.iter().any(|agent| agent == "*"))
                .collect()
        } else {
            exact
        };
        let mut applicable = Vec::new();
        for group in selected {
            for rule in &group.rules {
                if rule_matches(&rule.path, &path) {
                    applicable.push(rule.clone());
                }
            }
        }
        let longest = applicable
            .iter()
            .map(|rule| rule.path.len())
            .max()
            .unwrap_or(0);
        let winning: Vec<_> = applicable
            .iter()
            .filter(|rule| rule.path.len() == longest)
            .collect();
        let allowed = winning
            .iter()
            .any(|rule| rule.directive == RuleDirective::Allow)
            || winning.is_empty();
        let explanation = if winning.is_empty() {
            "No matching robots directive was found; the parsed policy permits this path for the evaluated user agent.".into()
        } else if allowed {
            "The most specific matching directive permits this path. This is a permission signal, not evidence of a crawl.".into()
        } else {
            "The most specific matching directive disallows this path. This is a permission signal, not evidence of a crawler visit.".into()
        };
        AccessEvaluation {
            user_agent: user_agent.into(),
            path,
            allowed,
            applicable_rules: applicable,
            explanation,
        }
    }
}

fn rule_matches(pattern: &str, path: &str) -> bool {
    let anchored = pattern.ends_with('$');
    let pattern = pattern.trim_end_matches('$');
    if pattern.is_empty() {
        return true;
    }
    // Avoid a regex dependency in this policy parser: patterns without wildcard are the normal
    // case, and wildcard matching is evaluated with a small deterministic glob routine.
    glob_matches(pattern, path, anchored)
}

fn glob_matches(pattern: &str, value: &str, anchored: bool) -> bool {
    let parts: Vec<_> = pattern.split('*').collect();
    if parts.len() == 1 {
        return if anchored {
            value == pattern
        } else {
            value.starts_with(pattern)
        };
    }
    if !value.starts_with(parts[0]) {
        return false;
    }
    let mut offset = parts[0].len();
    for part in parts.iter().skip(1).take(parts.len().saturating_sub(2)) {
        let Some(found) = value[offset..].find(part) else {
            return false;
        };
        offset += found + part.len();
    }
    let last = parts.last().unwrap_or(&"");
    if anchored {
        value[offset..].ends_with(last)
    } else {
        value[offset..].contains(last)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn applies_most_specific_rule_and_allow_tie() {
        let doc = RobotsDocument::parse(
            "User-agent: *\nDisallow: /private\nAllow: /private/public\nSitemap: https://example.test/sitemap.xml",
        );
        assert!(
            !doc.evaluate("GPTBot", "https://example.test/private/a")
                .allowed
        );
        assert!(
            doc.evaluate("GPTBot", "https://example.test/private/public/a")
                .allowed
        );
        assert_eq!(doc.sitemaps, vec!["https://example.test/sitemap.xml"]);
    }

    #[test]
    fn evaluates_documented_specific_user_agent_group() {
        let doc = RobotsDocument::parse(
            "User-agent: *\nDisallow: /\nUser-agent: OAI-SearchBot\nAllow: /",
        );
        assert!(doc.evaluate("OAI-SearchBot", "/page").allowed);
        assert!(!doc.evaluate("ClaudeBot", "/page").allowed);
    }
}
