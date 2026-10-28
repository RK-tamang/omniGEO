//! HTML parsing and structured content extraction pipeline.
//!
//! Extracts page identity, metadata, headings, main content, links, images,
//! structured data (JSON-LD), brand signals, and content fingerprints.
//!
//! Reuses `answerscope-crawling::discovery::extract_links` for link extraction
//! and `sha2` for content fingerprinting.

use scraper::{ElementRef, Html, Selector};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use url::Url;

use crate::domain::{compute_content_fingerprint, ContentFingerprint, HeadingRecord, ImageRecord, LinkRecord};

const CLASS_SCORE: i32 = 25;
const ID_SCORE: i32 = 25;

const CONTENT_CLASSES: &[&str] = &[
    "article", "post", "hentry", "entry", "entry-content", "entry__content",
    "post-content", "post__content", "article-body", "main-content",
    "content-body", "page-content", "story-body", "entry-body",
    "primary-content", "main", "content",
];

const NON_CONTENT_CLASSES: &[&str] = &[
    "nav", "navigation", "menu", "sidebar", "aside", "widget", "widgets",
    "ad", "ads", "advertisement", "banner", "footer", "header", "navbar",
    "comment", "comments", "share", "social", "related", "popup",
    "modal", "overlay", "cookie", "consent", "newsletter", "search",
    "search-box", "pagination", "breadcrumbs", "meta", "author-bio",
    "tags", "category", "archive",
];

const SKIP_SELECTORS: &[&str] = &[
    "script", "style", "noscript", "iframe", "svg", "canvas",
    "audio", "video", "form", "button", "input", "select",
    "textarea", "nav", "footer", "header", "aside",
];

/// Complete extraction result for a single page.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionResult {
    pub title: Option<String>,
    pub meta_description: Option<String>,
    pub meta_robots: Option<String>,
    pub canonical_url: Option<String>,
    pub language: Option<String>,
    pub viewport: Option<String>,
    pub open_graph: serde_json::Value,
    pub headings: Vec<HeadingRecord>,
    pub main_text: String,
    pub markdown: String,
    pub word_count: usize,
    pub links: Vec<LinkRecord>,
    pub images: Vec<ImageRecord>,
    pub structured_data: Vec<serde_json::Value>,
    pub brand_signals: serde_json::Value,
    pub content_fingerprint: ContentFingerprint,
    pub extraction_version: String,
    pub extraction_quality: Option<f64>,
}

/// Run the full extraction pipeline on HTML.
pub fn extract(html: &str, requested_url: &Url) -> ExtractionResult {
    let document = Html::parse_document(html);
    let now_version = "1.0.0";

    // Title
    let title = document
        .select(&Selector::parse("title").unwrap())
        .next()
        .map(|n| n.text().collect::<Vec<_>>().join(" ").trim().to_owned())
        .filter(|v| !v.is_empty());

    // Meta tags
    let meta_description = select_attr(&document, "meta[name='description']", "content");
    let meta_robots = select_attr(&document, "meta[name='robots']", "content");
    let viewport = select_attr(&document, "meta[name='viewport']", "content");
    let language = select_attr(&document, "html", "lang");

    // Open Graph
    let open_graph = serde_json::json!({
        "title": select_attr(&document, "meta[property='og:title']", "content"),
        "description": select_attr(&document, "meta[property='og:description']", "content"),
        "image": select_attr(&document, "meta[property='og:image']", "content"),
        "site_name": select_attr(&document, "meta[property='og:site_name']", "content"),
        "type": select_attr(&document, "meta[property='og:type']", "content"),
    });

    // Canonical URL
    let canonical_raw = select_attr(&document, "link[rel='canonical']", "href");
    let canonical_url = canonical_raw
        .as_deref()
        .and_then(|v| requested_url.join(v).ok())
        .map(|u| u.to_string());

    // Headings H1-H6
    let headings = extract_headings(&document);

    // Main content extraction (readability-style)
    let main_content = extract_main_content(&document);
    let markdown = html_to_markdown(&main_content);
    let main_text = markdown
        .replace(&['#', '*', '>', '-', '|', '`', '_'][..], " ")
        .replace(&['[', ']', '(', ')'][..], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let word_count = main_text.split_whitespace().count();

    // Links
    let (internal_links, external_links) = crate::discovery::extract_links(html, requested_url);
    let mut links: Vec<LinkRecord> = internal_links
        .into_iter()
        .map(|u| LinkRecord {
            url: u.clone(),
            anchor_text: None,
            rel: None,
            is_internal: true,
            is_nofollow: false,
            is_sponsored: false,
            is_ugc: false,
        })
        .collect();
    for u in external_links {
        links.push(LinkRecord {
            url: u,
            anchor_text: None,
            rel: None,
            is_internal: false,
            is_nofollow: false,
            is_sponsored: false,
            is_ugc: false,
        });
    }

    // Images
    let images = extract_images(&document, requested_url);

    // Structured data (JSON-LD)
    let structured_data = extract_structured_data(&document);

    // Brand signals
    let brand_signals = extract_brand_signals(&document, &structured_data);

    // Content fingerprint
    let normalized = main_text.to_lowercase();
    let sha256 = compute_content_fingerprint(&normalized);
    let content_fingerprint = ContentFingerprint {
        sha256,
        simhash: None,
        normalized_text_version: "1.0".to_owned(),
    };

    // Extraction quality heuristic
    let extraction_quality = if word_count > 100 {
        Some(0.8)
    } else if word_count > 20 {
        Some(0.5)
    } else {
        Some(0.2)
    };

    ExtractionResult {
        title,
        meta_description,
        meta_robots,
        canonical_url,
        language,
        viewport,
        open_graph,
        headings,
        main_text: main_content.clone(),
        markdown,
        word_count,
        links,
        images,
        structured_data,
        brand_signals,
        content_fingerprint,
        extraction_version: now_version.to_owned(),
        extraction_quality,
    }
}

/// Select a single attribute from the first matching element.
fn select_attr(document: &Html, query: &str, attribute: &str) -> Option<String> {
    let selector = Selector::parse(query).ok()?;
    document
        .select(&selector)
        .next()?
        .value()
        .attr(attribute)
        .map(str::to_owned)
}

/// Extract H1-H6 headings with level and text.
fn extract_headings(document: &Html) -> Vec<HeadingRecord> {
    let mut headings = Vec::new();
    for level in 1..=6u8 {
        let selector = Selector::parse(&format!("h{level}")).unwrap();
        for node in document.select(&selector) {
            let text = node
                .text()
                .collect::<Vec<_>>()
                .join(" ")
                .trim()
                .to_owned();
            if !text.is_empty() {
                headings.push(HeadingRecord { level, text });
            }
        }
    }
    headings
}

/// Extract main content using readability-style scoring.
fn extract_main_content(document: &Html) -> String {
    let candidates: Vec<ElementRef> = document
        .select(&Selector::parse("div, section, article, main, td").unwrap())
        .filter(|n| {
            let text_len = n.text().map(|t| t.len()).sum::<usize>();
            text_len > 50
        })
        .collect();

    if candidates.is_empty() {
        return document.root_element().inner_html();
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

    match best {
        Some(node) => node.inner_html(),
        None => document.root_element().inner_html(),
    }
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

    let density = link_density(node);
    if density > 0.33 {
        score -= ((density - 0.33) * 100.0) as i32;
    }

    score
}

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

/// Convert extracted HTML to Markdown.
fn html_to_markdown(html: &str) -> String {
    let document = Html::parse_document(html);
    let mut out = String::new();

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

fn is_skipped(node: &ElementRef) -> bool {
    SKIP_SELECTORS.iter().any(|sel_str| {
        Selector::parse(sel_str)
            .ok()
            .map(|sel| node.select(&sel).next().is_some())
            .unwrap_or(false)
    })
}

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

/// Extract images with alt text and dimensions.
fn extract_images(document: &Html, base_url: &Url) -> Vec<ImageRecord> {
    let mut images = Vec::new();
    let selector = Selector::parse("img").unwrap();
    for node in document.select(&selector) {
        let src = node.value().attr("src").unwrap_or("");
        if src.is_empty() {
            continue;
        }
        let url = base_url.join(src).ok().map(|u| u.to_string()).unwrap_or_else(|| src.to_owned());
        images.push(ImageRecord {
            url,
            alt_text: node.value().attr("alt").map(|s| s.to_owned()).filter(|s| !s.is_empty()),
            width: node.value().attr("width").and_then(|v| v.parse().ok()),
            height: node.value().attr("height").and_then(|v| v.parse().ok()),
        });
    }
    images
}

/// Extract JSON-LD structured data.
fn extract_structured_data(document: &Html) -> Vec<serde_json::Value> {
    let mut data = Vec::new();
    let selector = Selector::parse(r#"script[type="application/ld+json"]"#).unwrap();
    for node in document.select(&selector) {
        let content = node.inner_html();
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) {
            data.push(value);
        }
    }
    data
}

/// Extract brand signals from page content and structured data.
fn extract_brand_signals(document: &Html, structured_data: &[serde_json::Value]) -> serde_json::Value {
    let mut org_names = Vec::new();
    let mut logos = Vec::new();

    // From JSON-LD Organization
    for value in structured_data {
        if let Some(obj) = value.as_object() {
            if let Some(name) = obj.get("name").and_then(|v| v.as_str()) {
                org_names.push(name.to_owned());
            }
            if let Some(logo) = obj.get("logo").and_then(|v| v.as_str()) {
                logos.push(logo.to_owned());
            }
            if let Some(org) = obj.get("organization").and_then(|v| v.as_object()) {
                if let Some(name) = org.get("name").and_then(|v| v.as_str()) {
                    org_names.push(name.to_owned());
                }
            }
        }
    }

    // From og:site_name
    if let Some(site) = select_attr(document, "meta[property='og:site_name']", "content") {
        org_names.push(site);
    }

    org_names.sort();
    org_names.dedup();

    serde_json::json!({
        "organization_names": org_names,
        "logos": logos,
        "detected_from": if org_names.is_empty() { "none" } else { "json_ld_and_meta" },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use url::Url;

    #[test]
    fn extracts_title_and_description() {
        let html = r#"<html><head>
            <title>Test Page</title>
            <meta name="description" content="A test page for crawling.">
        </head><body><h1>Hello</h1><p>Content here.</p></body></html>"#;
        let url = Url::parse("https://example.com/").unwrap();
        let result = extract(html, &url);
        assert_eq!(result.title.as_deref(), Some("Test Page"));
        assert_eq!(result.meta_description.as_deref(), Some("A test page for crawling."));
    }

    #[test]
    fn extracts_headings_h1_h6() {
        let html = r#"<html><body>
            <h1>Main Title</h1>
            <h2>Subtitle</h2>
            <h3>Detail</h3>
        </body></html>"#;
        let url = Url::parse("https://example.com/").unwrap();
        let result = extract(html, &url);
        assert_eq!(result.headings.len(), 3);
        assert_eq!(result.headings[0].level, 1);
        assert_eq!(result.headings[0].text, "Main Title");
        assert_eq!(result.headings[1].level, 2);
        assert_eq!(result.headings[2].level, 3);
    }

    #[test]
    fn extracts_json_ld() {
        let html = r#"<html><head>
            <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"Organization","name":"Acme Corp"}
            </script>
        </head><body><p>Content</p></body></html>"#;
        let url = Url::parse("https://example.com/").unwrap();
        let result = extract(html, &url);
        assert_eq!(result.structured_data.len(), 1);
        assert_eq!(
            result.structured_data[0]["@type"],
            serde_json::json!("Organization")
        );
    }

    #[test]
    fn extracts_internal_and_external_links() {
        let html = r#"<html><body>
            <a href="/about">About</a>
            <a href="https://other.com/external">External</a>
        </body></html>"#;
        let url = Url::parse("https://example.com/").unwrap();
        let result = extract(html, &url);
        assert!(result.links.iter().any(|l| l.is_internal && l.url.contains("/about")));
        assert!(result.links.iter().any(|l| !l.is_internal && l.url.contains("other.com")));
    }

    #[test]
    fn content_fingerprint_is_generated() {
        let html = r#"<html><body><p>Unique content for fingerprinting.</p></body></html>"#;
        let url = Url::parse("https://example.com/").unwrap();
        let result = extract(html, &url);
        assert!(!result.content_fingerprint.sha256.is_empty());
        assert_eq!(result.content_fingerprint.sha256.len(), 64);
    }

    #[test]
    fn duplicate_content_has_same_fingerprint() {
        let html = r#"<html><body><p>Same content here.</p></body></html>"#;
        let url = Url::parse("https://example.com/").unwrap();
        let a = extract(html, &url);
        let b = extract(html, &url);
        assert_eq!(a.content_fingerprint.sha256, b.content_fingerprint.sha256);
    }
}
