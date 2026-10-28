use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportDocument {
    pub report_type: String,
    pub project_name: Option<String>,
    pub brand_aliases: Vec<String>,
    pub domain: String,
    pub configured_page_limit: usize,
    pub audit_status: String,
    pub summary: String,
    pub audit_started_at: Option<DateTime<Utc>>,
    pub audit_completed_at: Option<DateTime<Utc>>,
    pub generated_at: DateTime<Utc>,
    pub readiness_score: Option<ReadinessScore>,
    pub crawled_pages: usize,
    pub findings: Vec<ReportFinding>,
    pub opportunities: Vec<ReportOpportunity>,
    pub coverage_limitations: Vec<String>,
    pub methodology: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadinessScore {
    pub overall: u8,
    pub technical: u8,
    pub metadata: u8,
    pub content_structure: u8,
    pub schema: u8,
    pub internal_links: u8,
    pub confidence: u8,
    pub crawl_budget_utilization: u8,
    pub evidence_categories: Value,
    pub methodology_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportFinding {
    pub code: String,
    pub severity: String,
    pub title: String,
    pub affected_url: Option<String>,
    pub evidence: Value,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportOpportunity {
    pub priority: i16,
    pub title: String,
    pub affected_url: Option<String>,
    pub evidence: Value,
    pub recommendation: String,
}

#[derive(Debug, thiserror::Error)]
pub enum RenderError {
    #[error("unsupported report format: {0}")]
    UnsupportedFormat(String),
    #[error("report serialization failed: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub fn render(format: &str, document: &ReportDocument) -> Result<(String, Vec<u8>), RenderError> {
    match format {
        "json" => Ok((
            "application/json".into(),
            serde_json::to_vec_pretty(document)?,
        )),
        "csv" => Ok((
            "text/csv; charset=utf-8".into(),
            render_csv(document).into_bytes(),
        )),
        "pdf" => Ok(("application/pdf".into(), render_pdf(document))),
        other => Err(RenderError::UnsupportedFormat(other.into())),
    }
}

fn render_csv(document: &ReportDocument) -> String {
    let mut output = String::from(
        "record_type,domain,project,audit_status,score,code,severity,priority,title,affected_url,recommendation,evidence\r\n",
    );
    output.push_str(&format!(
        "summary,{},{},{},{},,,,,,,\r\n",
        cell(&document.domain),
        cell(document.project_name.as_deref().unwrap_or_default()),
        cell(&document.audit_status),
        document
            .readiness_score
            .as_ref()
            .map(|score| score.overall.to_string())
            .unwrap_or_default()
    ));
    for finding in &document.findings {
        output.push_str(&format!(
            "finding,{},{},{},{},{},{},,{},{},{},{}\r\n",
            cell(&document.domain),
            cell(document.project_name.as_deref().unwrap_or_default()),
            cell(&document.audit_status),
            document
                .readiness_score
                .as_ref()
                .map(|score| score.overall.to_string())
                .unwrap_or_default(),
            cell(&finding.code),
            cell(&finding.severity),
            cell(&finding.title),
            cell(finding.affected_url.as_deref().unwrap_or_default()),
            cell(&finding.recommendation),
            cell(&finding.evidence.to_string())
        ));
    }
    for opportunity in &document.opportunities {
        output.push_str(&format!(
            "opportunity,{},{},,,,,{},{},{},{},{}\r\n",
            cell(&document.domain),
            cell(document.project_name.as_deref().unwrap_or_default()),
            opportunity.priority,
            cell(&opportunity.title),
            cell(opportunity.affected_url.as_deref().unwrap_or_default()),
            cell(&opportunity.recommendation),
            cell(&opportunity.evidence.to_string())
        ));
    }
    output
}

fn cell(value: &str) -> String {
    let guarded = if value
        .trim_start()
        .chars()
        .next()
        .is_some_and(|ch| matches!(ch, '=' | '+' | '-' | '@' | '\t' | '\r'))
    {
        format!("'{}", value)
    } else {
        value.to_owned()
    };
    format!("\"{}\"", guarded.replace('"', "\"\""))
}

fn render_pdf(document: &ReportDocument) -> Vec<u8> {
    let mut lines = vec![
        "ANSWERSCOPE | GEO AUDIT REPORT".to_owned(),
        format!(
            "Project: {}",
            document
                .project_name
                .as_deref()
                .unwrap_or("Unassigned project")
        ),
        format!(
            "Brand aliases: {}",
            if document.brand_aliases.is_empty() {
                "Not configured".into()
            } else {
                document.brand_aliases.join(", ")
            }
        ),
        format!("Domain: {}", document.domain),
        format!("Report: {}", document.report_type),
        format!("Audit status: {}", document.audit_status),
        format!("Generated: {}", document.generated_at.to_rfc3339()),
        format!(
            "Pages crawled: {} / {} configured",
            document.crawled_pages, document.configured_page_limit
        ),
        String::new(),
        "GEO READINESS".into(),
        format!("SUMMARY: {}", document.summary),
    ];
    if let Some(completed_at) = document.audit_completed_at {
        lines.push(format!("Audit completed: {}", completed_at.to_rfc3339()));
    }
    if let Some(score) = &document.readiness_score {
        lines.push(format!(
            "Overall: {}/100 | Confidence: {}% | Crawl budget used: {}%",
            score.overall, score.confidence, score.crawl_budget_utilization
        ));
        lines.push(format!(
            "Technical: {} | Metadata: {} | Structure: {} | Schema: {} | Links: {}",
            score.technical,
            score.metadata,
            score.content_structure,
            score.schema,
            score.internal_links
        ));
        lines.push(format!(
            "Methodology version: {}",
            score.methodology_version
        ));
    } else {
        lines.push("Score unavailable: audit score evidence was not saved.".into());
    }
    lines.extend([
        String::new(),
        "METHODOLOGY".into(),
        document.methodology.clone(),
        String::new(),
        "FINDINGS AND RECOMMENDATIONS".into(),
    ]);
    for (index, finding) in document.findings.iter().enumerate() {
        lines.push(format!(
            "{}. [{}] {} ({})",
            index + 1,
            finding.severity.to_uppercase(),
            finding.title,
            finding.code
        ));
        if let Some(url) = &finding.affected_url {
            lines.push(format!("Affected URL: {url}"));
        }
        lines.push(format!("Evidence: {}", finding.evidence));
        lines.push(format!("Action: {}", finding.recommendation));
        lines.push(String::new());
    }
    if !document.opportunities.is_empty() {
        lines.extend([String::new(), "OPTIMIZATION OPPORTUNITIES".into()]);
        for item in &document.opportunities {
            lines.push(format!("Priority {}: {}", item.priority, item.title));
            if let Some(url) = &item.affected_url {
                lines.push(format!("Affected URL: {url}"));
            }
            lines.push(format!("Evidence: {}", item.evidence));
            lines.push(format!("Action: {}", item.recommendation));
            lines.push(String::new());
        }
    }
    lines.push("DATA COVERAGE AND LIMITATIONS".into());
    lines.push(format!(
        "{} pages were crawled within the configured crawl scope.",
        document.crawled_pages
    ));
    for limitation in &document.coverage_limitations {
        lines.push(format!("- {limitation}"));
    }
    lines.push(
        "GEO Readiness is derived from website audit evidence. It is not observed AI visibility."
            .into(),
    );

    let wrapped: Vec<String> = lines
        .into_iter()
        .flat_map(|line| wrap_text(&line, 92))
        .collect();
    let pages: Vec<Vec<String>> = wrapped.chunks(48).map(|chunk| chunk.to_vec()).collect();
    let page_count = pages.len().max(1);
    let pages_obj = 2;
    let regular_font_obj = 3 + page_count * 2;
    let bold_font_obj = regular_font_obj + 1;
    let mut objects = vec![String::new(); bold_font_obj];
    let kids = (0..page_count)
        .map(|index| format!("{} 0 R", 3 + index * 2))
        .collect::<Vec<_>>()
        .join(" ");
    objects[0] = "<< /Type /Catalog /Pages 2 0 R >>".into();
    objects[1] = format!("<< /Type /Pages /Kids [{kids}] /Count {page_count} >>");
    for (index, page_lines) in pages.iter().enumerate() {
        let page_obj = 3 + index * 2;
        let stream_obj = page_obj + 1;
        let mut stream = String::from("0.36 0.24 0.57 rg 48 764 516 4 re f\n");
        for (line_index, line) in page_lines.iter().enumerate() {
            let y = 742 - (line_index as i32 * 14);
            let is_title = index == 0 && line_index == 0;
            let is_heading = matches!(
                line.as_str(),
                "GEO READINESS"
                    | "METHODOLOGY"
                    | "FINDINGS AND RECOMMENDATIONS"
                    | "OPTIMIZATION OPPORTUNITIES"
                    | "DATA COVERAGE AND LIMITATIONS"
            );
            if is_title {
                stream.push_str(&format!(
                    "BT /F2 17 Tf 0.27 0.18 0.43 rg 48 {y} Td ({}) Tj ET\n",
                    pdf_text(line)
                ));
            } else if is_heading {
                stream.push_str(&format!(
                    "BT /F2 11 Tf 0.31 0.23 0.48 rg 48 {y} Td ({}) Tj ET\n",
                    pdf_text(line)
                ));
            } else if line.chars().next().is_some_and(|ch| ch.is_ascii_digit())
                && line.contains("] ")
            {
                stream.push_str(&format!(
                    "BT /F2 9 Tf 0.12 0.12 0.16 rg 48 {y} Td ({}) Tj ET\n",
                    pdf_text(line)
                ));
            } else {
                stream.push_str(&format!(
                    "BT /F1 9 Tf 0.12 0.12 0.16 rg 48 {y} Td ({}) Tj ET\n",
                    pdf_text(line)
                ));
            }
        }
        stream.push_str(&format!(
            "BT /F1 8 Tf 0.42 0.42 0.46 rg 48 28 Td (AnswerScope | {} | Page {} of {}) Tj ET",
            pdf_text(&document.domain),
            index + 1,
            page_count
        ));
        objects[page_obj - 1] = format!(
            "<< /Type /Page /Parent {pages_obj} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {regular_font_obj} 0 R /F2 {bold_font_obj} 0 R >> >> /Contents {stream_obj} 0 R >>"
        );
        objects[stream_obj - 1] = format!(
            "<< /Length {} >>\nstream\n{}\nendstream",
            stream.len(),
            stream
        );
    }
    objects[regular_font_obj - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".into();
    objects[bold_font_obj - 1] =
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>".into();
    let mut pdf = b"%PDF-1.4\n".to_vec();
    let mut offsets = vec![0usize];
    for (index, object) in objects.iter().enumerate() {
        offsets.push(pdf.len());
        pdf.extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", index + 1, object).as_bytes());
    }
    let xref = pdf.len();
    pdf.extend_from_slice(
        format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1).as_bytes(),
    );
    for offset in offsets.iter().skip(1) {
        pdf.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    pdf.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF",
            objects.len() + 1
        )
        .as_bytes(),
    );
    pdf
}

fn pdf_text(value: &str) -> String {
    let ascii: String = value
        .chars()
        .map(|ch| {
            if ch.is_ascii() && !ch.is_control() {
                ch
            } else {
                '?'
            }
        })
        .collect();
    ascii
        .replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
}

fn wrap_text(value: &str, width: usize) -> Vec<String> {
    if value.is_empty() {
        return vec![String::new()];
    }
    let mut lines = Vec::new();
    let mut current = String::new();
    for word in value.split_whitespace() {
        if !current.is_empty() && current.len() + 1 + word.len() > width {
            lines.push(std::mem::take(&mut current));
        }
        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(word);
    }
    if !current.is_empty() {
        lines.push(current);
    }
    lines
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn document() -> ReportDocument {
        ReportDocument {
            report_type: "geo_audit".into(),
            project_name: Some("Example project".into()),
            brand_aliases: vec!["Example".into()],
            domain: "https://example.test".into(),
            configured_page_limit: 10,
            audit_status: "completed".into(),
            summary: "Example completed report.".into(),
            audit_started_at: None,
            audit_completed_at: None,
            generated_at: DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
            readiness_score: None,
            crawled_pages: 2,
            findings: vec![ReportFinding {
                code: "content.thin".into(),
                severity: "medium".into(),
                title: "=HYPERLINK(\"https://bad.test\")".into(),
                affected_url: Some("https://example.test/page".into()),
                evidence: json!({"url":"https://example.test/page"}),
                recommendation: "Add useful detail.".into(),
            }],
            opportunities: vec![],
            coverage_limitations: vec!["Two pages were within scope.".into()],
            methodology: "Documented weights.".into(),
        }
    }

    #[test]
    fn emits_json_csv_and_pdf_artifacts() {
        let report = document();
        let (json_type, json_bytes) = render("json", &report).unwrap();
        assert_eq!(json_type, "application/json");
        assert!(serde_json::from_slice::<ReportDocument>(&json_bytes).is_ok());

        let (csv_type, csv_bytes) = render("csv", &report).unwrap();
        let csv = String::from_utf8(csv_bytes).unwrap();
        assert!(csv_type.starts_with("text/csv"));
        assert!(csv.contains("'=HYPERLINK"));
        assert!(csv.contains("content.thin"));

        let (pdf_type, pdf_bytes) = render("pdf", &report).unwrap();
        assert_eq!(pdf_type, "application/pdf");
        assert!(pdf_bytes.starts_with(b"%PDF-1.4"));
        assert!(String::from_utf8_lossy(&pdf_bytes).contains("DATA COVERAGE AND LIMITATIONS"));
    }

    #[test]
    fn rejects_unknown_export_format() {
        assert!(matches!(
            render("xlsx", &document()),
            Err(RenderError::UnsupportedFormat(_))
        ));
    }
}
