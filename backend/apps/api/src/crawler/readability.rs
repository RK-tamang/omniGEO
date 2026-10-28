//! Readability-style main content extraction (Firecrawl-inspired).
//!
//! Scores candidate content nodes, strips boilerplate (nav, footer, ads,
//! sidebars, widgets), and returns the cleaned main article text plus
//! a markdown rendering.

use scraper::{ElementRef, Html, Selector};
use sha2::{Digest, Sha256};

const CLASS_SCORE: i32 = 25;
const ID_SCORE: i32 = 25;

/// Classes/IDs that strongly indicate content (positive weight).
const CONTENT_CLASSES: &[&str] = &[
    "article", "post", "hentry", "entry", "entry-content", "entry__content",
    "post-content", "post__content", "article-body", "main-content",
    "content-body", "page-content", "story-body", "entry-body",
    "primary-content", "main", "content",
];
/// Classes/IDs that strongly indicate non-content (negative weight).
const NON_CONTENT_CLASSES: &[&str] = &[
    "nav", "navigation", "menu", "sidebar", "aside", "widget", "widgets",
    "ad", "ads", "advertisement", "banner", "footer", "header", "navbar",
    "comment", "comments", "share", "social", "related", "popup",
    "modal", "overlay", "cookie", "consent", "newsletter", "search",
    "search-box", "pagination", "breadcrumbs", "meta", "author-bio",
    "tags", "category", "archive",
];

/// Tag-level content score bonuses.
fn tag_score(tag: &str) -> i32 {
    match tag {
        "div" => 5,
        "blockquote" => 3,
        "pre" | "table" => 3,
        "article" | "main" | "section" => 0,
        "td" => 0,
        "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => -3,
        "ul" | "ol" | "li" => -3,
        "form" | "input" | "button" | "textarea" | "select" => -10,
        "header" | "footer" | "nav" | "aside" => -10,
        _ => 0,
    }
}

/// Class-level score adjustment.
fn class_score(class_attr: &str) -> i32 {
    let mut score = 0;
    let lowered = class_attr.to_ascii_lowercase();
    for cls in CONTENT_CLASSES {
        if lowered.contains(cls) {
            score += CLASS_SCORE;
        }
    }
    for cls in NON_CONTENT_CLASSES {
        if lowered.contains(cls) {
            score -= CLASS_SCORE;
        }
    }
    score
}

/// ID-level score adjustment.
fn id_score(id_attr: &str) -> i32 {
    let mut score = 0;
    let lowered = id_attr.to_ascii_lowercase();
    for cls in CONTENT_CLASSES {
        if lowered.contains(cls) {
            score += ID_SCORE;
        }
    }
    for cls in NON_CONTENT_CLASSES {
        if lowered.contains(cls) {
            score -= ID_SCORE;
        }
    }
    score
}

/// Link density: ratio of link text length to total text length.
fn link_density(node: &ElementRef) -> f64 {
    let total_len: usize = node.text().map(|t| t.len()).sum();
    if total_len == 0 {
        return 0.0;
    }
    let link_len: usize = node
        .select(&Selector::parse("a").unwrap())
        .flat_map(|a| a.text().map(|t| t.len()))
        .sum();
    link_len as f64 / total_len as f64
}

/// Score a candidate element as a content container.
fn score_node(node: &ElementRef) -> i32 {
    let mut score = 0;
    let tag = node.value().name();
    score += tag_score(tag);

    if let Some(cls) = node.value().attr("class") {
        score += class_score(cls);
    }
    if let Some(id) = node.value().attr("id") {
        score += id_score(id);
    }

    // Penalize high link density (likely a nav or sidebar).
    let density = link_density(node);
    if density > 0.33 {
        score -= ((density - 0.33) * 100.0) as i32;
    }

    score
}

/// Return the best-scoring content container under root.
fn find_best_node(document: &Html) -> Option<ElementRef> {
    let candidates: Vec<_> = document
        .select(&Selector::parse("div, section, article, main, td").unwrap())
        .filter(|n| {
            let text_len = n.text().map(|t| t.len()).sum::<usize>();
            text_len > 50 && link_density(n) < 0.85
        })
        .collect();

    if candidates.is_empty() {
        return None;
    }

    let mut best = None;
    let mut best_score = i32::MIN;
    for cand in &candidates {
        let s = score_node(cand);
        if s > best_score {
            best_score = s;
            best = Some(cand.clone());
        }
    }
    best
}

/// Selectors for elements to skip during markdown conversion.
const SKIP_SELECTORS: &[&str] = &[
    "script", "style", "noscript", "iframe", "svg", "canvas",
    "audio", "video", "form", "button", "input", "select",
    "textarea", "nav", "footer", "header", "aside",
];

/// Check if an element matches any skip selector.
fn is_skipped(node: &ElementRef) -> bool {
    SKIP_SELECTORS.iter().any(|sel_str| {
        Selector::parse(sel_str)
            .ok()
            .map(|sel| node.select(&sel).next().is_some())
            .unwrap_or(false)
    })
}

/// Convert an element tree to Markdown.
fn node_to_markdown(node: &ElementRef, out: &mut String) {
    if is_skipped(node) {
        return;
    }

    let tag = node.value().name();
    match tag {
        "h1" => {
            let text = node.text().collect::<Vec<_>>().join(" ").trim().to_owned();
            out.push_str(&format!("# {}\n\n", text));
        }
        "h2" => {
            let text = node.text().collect::<Vec<_>>().join(" ").trim().to_owned();
            out.push_str(&format!("## {}\n\n", text));
        }
        "h3" => {
            let text = node.text().collect::<Vec<_>>().join(" ").trim().to_owned();
            out.push_str(&format!("### {}\n\n", text));
        }
        "h4" => {
            let text = node.text().collect::<Vec<_>>().join(" ").trim().to_owned();
            out.push_str(&format!("#### {}\n\n", text));
        }
        "h5" => {
            let text = node.text().collect::<Vec<_>>().join(" ").trim().to_owned();
            out.push_str(&format!("##### {}\n\n", text));
        }
        "h6" => {
            let text = node.text().collect::<Vec<_>>().join(" ").trim().to_owned();
            out.push_str(&format!("###### {}\n\n", text));
        }
        "p" => {
            let text = node.text().collect::<Vec<_>>().join(" ").trim().to_owned();
            if !text.is_empty() {
                out.push_str(&text);
                out.push_str("\n\n");
            }
        }
        "a" => {
            let text = node.text().collect::<Vec<_>>().join(" ").trim().to_owned();
            let href = node.value().attr("href").unwrap_or("");
            if !text.is_empty() && !href.is_empty() {
                out.push_str(&format!("[{}]({}) ", text, href));
            } else if !text.is_empty() {
                out.push_str(&format!("{} ", text));
            }
        }
        "ul" | "ol" => {
            let mut index = 1;
            for li in node.select(&Selector::parse("> li").unwrap()) {
                if is_skipped(&li) {
                    continue;
                }
                let item_text = li.text().collect::<Vec<_>>().join(" ").trim().to_owned();
                if tag == "ol" {
                    out.push_str(&format!("{}. {}\n", index, item_text));
                    index += 1;
                } else {
                    out.push_str(&format!("- {}\n", item_text));
                }
            }
            out.push('\n');
        }
        "blockquote" => {
            let text = node.text().collect::<Vec<_>>().join(" ").trim().to_owned();
            if !text.is_empty() {
                out.push_str(&format!("> {}\n\n", text));
            }
        }
        "pre" | "code" => {
            let text = node.text().collect::<Vec<_>>().join(" ");
            if !text.is_empty() {
                out.push_str(&format!("```\n{}\n```\n\n", text));
            }
        }
        "img" => {
            let alt = node.value().attr("alt").unwrap_or("");
            let src = node.value().attr("src").unwrap_or("");
            if !src.is_empty() {
                out.push_str(&format!("![{}]({}) ", alt, src));
            }
        }
        "br" => out.push_str("\n"),
        "hr" => out.push_str("---\n\n"),
        "table" => {
            let text = node.text().collect::<Vec<_>>().join(" | ");
            if !text.is_empty() {
                out.push_str(&format!("| {} |\n\n", text));
            }
        }
        "li" => {}
        "div" | "section" | "article" | "main" | "td" | "th" | "tr" | "span" => {
            // Recurse into matching child elements.
            for child_selector in &[
                "h1, h2, h3, h4, h5, h6",
                "p",
                "a",
                "ul, ol",
                "blockquote",
                "pre, code",
                "img",
                "br",
                "hr",
                "table",
                "div, section, article, main, td, th, tr, span",
            ] {
                if let Ok(sel) = Selector::parse(child_selector) {
                    for child in node.select(&sel) {
                        node_to_markdown(&child, out);
                    }
                }
            }
        }
        _ => {
            let text = node.text().collect::<Vec<_>>().join(" ").trim().to_owned();
            if !text.is_empty() {
                out.push_str(&text);
                out.push(' ');
            }
        }
    }
}

/// Convert extracted HTML to Markdown.
pub fn html_to_markdown(html: &str) -> String {
    let document = Html::parse_document(html);
    let mut out = String::new();

    // Process top-level elements in document order using selectors.
    for child_selector in &[
        "h1, h2, h3, h4, h5, h6",
        "p",
        "a",
        "ul, ol",
        "blockquote",
        "pre, code",
        "img",
        "br",
        "hr",
        "table",
        "div, section, article, main, td, th, tr, span",
    ] {
        if let Ok(sel) = Selector::parse(child_selector) {
            for node in document.select(&sel) {
                node_to_markdown(&node, &mut out);
            }
        }
    }

    let collapsed: String = out
        .split_inclusive('\n')
        .map(|line| line.trim_end())
        .collect::<Vec<_>>()
        .join("")
        .replace("\n\n\n", "\n\n")
        .trim()
        .to_owned();

    if collapsed.is_empty() {
        document.root_element().text().collect::<Vec<_>>().join(" ")
    } else {
        collapsed
    }
}

/// Extraction result.
#[derive(Debug, Clone)]
pub struct ExtractedContent {
    pub title: Option<String>,
    pub main_text: String,
    pub markdown: String,
    pub word_count: usize,
    pub content_hash: String,
}

/// Run readability extraction on raw HTML.
pub fn extract(document: &Html, requested_title: Option<&str>) -> ExtractedContent {
    let title = requested_title
        .map(|t| t.to_owned())
        .or_else(|| {
            document
                .select(&Selector::parse("title").unwrap())
                .next()
                .map(|n| n.text().collect::<Vec<_>>().join(" ").trim().to_owned())
        });

    let best = find_best_node(document);
    let content_html = match &best {
        Some(node) => node.inner_html(),
        None => document.root_element().inner_html(),
    };

    let markdown = html_to_markdown(&content_html);

    let main_text = markdown
        .replace(&['#', '*', '>', '-', '|', '`', '_'][..], " ")
        .replace(&['[', ']', '(', ')'][..], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    let word_count = main_text.split_whitespace().count();

    let normalized = main_text.to_lowercase();
    let content_hash = Sha256::digest(normalized.as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();

    ExtractedContent {
        title,
        main_text,
        markdown,
        word_count,
        content_hash,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_main_content_and_strips_nav() {
        let html = r#"<html><body>
          <nav class="navigation"><ul><li><a href="/">Home</a></li></ul></nav>
          <main class="article-body"><h1>Article Title</h1><p>This is the main article content about important things.</p></main>
          <footer><p>Footer text</p></footer>
        </body></html>"#;
        let document = Html::parse_document(html);
        let result = extract(&document, None);
        assert!(result.main_text.contains("Article Title"));
        assert!(result.main_text.contains("main article content"));
        assert!(!result.main_text.contains("Home"));
        assert!(!result.main_text.contains("Footer text"));
    }

    #[test]
    fn converts_links_to_markdown() {
        let html = "<p>Visit <a href=\"https://example.com\">Example Site</a> for details.</p>";
        let document = Html::parse_document(html);
        let result = extract(&document, None);
        assert!(result.markdown.contains("[Example Site](https://example.com)"));
    }
}
