//! XML sitemap parsing. Fetching and scope enforcement remain in the crawler worker/API.
use quick_xml::{Reader, events::Event};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct SitemapDocument {
    pub kind: SitemapKind,
    pub entries: Vec<SitemapEntry>,
    pub parse_warnings: Vec<String>,
}
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SitemapKind {
    UrlSet,
    SitemapIndex,
    Unknown,
}
#[derive(Debug, Clone, Serialize)]
pub struct SitemapEntry {
    pub location: String,
    pub last_modified: Option<String>,
}

pub fn parse(source: &str) -> SitemapDocument {
    let mut reader = Reader::from_str(source);
    reader.config_mut().trim_text(true);
    let mut kind = SitemapKind::Unknown;
    let mut entries = Vec::new();
    let mut warnings = Vec::new();
    let mut in_url = false;
    let mut in_sitemap = false;
    let mut current_location: Option<String> = None;
    let mut current_lastmod: Option<String> = None;
    let mut field: Option<&'static str> = None;
    loop {
        match reader.read_event() {
            Ok(Event::Start(element)) => match element.name().as_ref() {
                b"urlset" => kind = SitemapKind::UrlSet,
                b"sitemapindex" => kind = SitemapKind::SitemapIndex,
                b"url" => {
                    in_url = true;
                    current_location = None;
                    current_lastmod = None;
                }
                b"sitemap" => {
                    in_sitemap = true;
                    current_location = None;
                    current_lastmod = None;
                }
                b"loc" if in_url || in_sitemap => field = Some("loc"),
                b"lastmod" if in_url || in_sitemap => field = Some("lastmod"),
                _ => {}
            },
            Ok(Event::Text(text)) => match field.take() {
                Some("loc") => match text.unescape() {
                    Ok(value) => current_location = Some(value.into_owned()),
                    Err(_) => warnings.push("A sitemap location could not be decoded.".into()),
                },
                Some("lastmod") => {
                    if let Ok(value) = text.unescape() {
                        current_lastmod = Some(value.into_owned());
                    }
                }
                _ => {}
            },
            Ok(Event::End(element))
                if element.name().as_ref() == b"url" || element.name().as_ref() == b"sitemap" =>
            {
                if let Some(location) = current_location.take() {
                    entries.push(SitemapEntry {
                        location,
                        last_modified: current_lastmod.take(),
                    });
                } else {
                    warnings.push("A sitemap entry has no loc value.".into());
                }
                in_url = false;
                in_sitemap = false;
                field = None;
            }
            Ok(Event::Eof) => break,
            Err(error) => {
                warnings.push(format!("XML parse error: {error}"));
                break;
            }
            _ => {}
        }
    }
    if kind == SitemapKind::Unknown {
        warnings.push("The XML does not declare a sitemapindex or urlset root element.".into());
    }
    SitemapDocument {
        kind,
        entries,
        parse_warnings: warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_urlset_and_last_modified_values() {
        let parsed = parse(
            r#"<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.test/a?x=1&amp;y=2</loc><lastmod>2026-01-01</lastmod></url></urlset>"#,
        );
        assert_eq!(parsed.kind, SitemapKind::UrlSet);
        assert_eq!(parsed.entries[0].location, "https://example.test/a?x=1&y=2");
        assert_eq!(
            parsed.entries[0].last_modified.as_deref(),
            Some("2026-01-01")
        );
    }

    #[test]
    fn parses_index_and_reports_bad_documents() {
        let index = parse(
            "<sitemapindex><sitemap><loc>https://example.test/child.xml</loc></sitemap></sitemapindex>",
        );
        assert_eq!(index.kind, SitemapKind::SitemapIndex);
        assert_eq!(index.entries.len(), 1);
        assert!(!parse("<not-xml").parse_warnings.is_empty());
    }
}
