use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ContentAnalysis {
    pub word_count: usize,
    pub sentence_count: usize,
    pub question_count: usize,
    pub repeated_terms: Vec<String>,
    pub readability: Readability,
    pub factual_signals: FactualSignals,
    pub findings: Vec<ContentFinding>,
}
#[derive(Debug, Serialize)]
pub struct FactualSignals {
    pub organization_reference: bool,
    pub location_reference: bool,
    pub contact_reference: bool,
    pub offering_reference: bool,
    pub citation_or_reference_signal: bool,
    pub question_answer_pattern: bool,
}
#[derive(Debug, Serialize)]
pub struct Readability {
    pub average_sentence_words: f32,
    pub estimated_grade: f32,
    pub limitation: &'static str,
}
#[derive(Debug, Serialize)]
pub struct ContentFinding {
    pub code: &'static str,
    pub severity: &'static str,
    pub title: &'static str,
    pub evidence: serde_json::Value,
    pub recommendation: &'static str,
}

pub fn analyze(text: &str, headings: &[String]) -> ContentAnalysis {
    let words: Vec<_> = text
        .split_whitespace()
        .filter(|word| word.chars().any(char::is_alphabetic))
        .collect();
    let sentences = text.matches(['.', '!', '?']).count().max(1);
    let questions = text.matches('?').count();
    let mut frequency = std::collections::BTreeMap::<String, usize>::new();
    for word in &words {
        let term = word
            .trim_matches(|c: char| !c.is_alphanumeric())
            .to_ascii_lowercase();
        if term.len() >= 5 {
            *frequency.entry(term).or_default() += 1;
        }
    }
    let repeated_terms = frequency
        .into_iter()
        .filter_map(|(term, count)| (count >= 5).then_some(term))
        .take(10)
        .collect();
    let avg = words.len() as f32 / sentences as f32;
    let mut findings = Vec::new();
    let normalized = format!(" {} ", text.to_ascii_lowercase());
    let organization_reference = [
        "about us",
        "our company",
        "our team",
        "founded",
        "organization",
    ]
    .iter()
    .any(|term| normalized.contains(term));
    let location_reference = [
        "address", "located", "location", "serving", "city", "country",
    ]
    .iter()
    .any(|term| normalized.contains(term));
    let contact_reference = ["contact", "email", "phone", "tel:", "get in touch"]
        .iter()
        .any(|term| normalized.contains(term));
    let offering_reference = ["services", "products", "we offer", "solutions", "pricing"]
        .iter()
        .any(|term| normalized.contains(term));
    let citation_or_reference_signal =
        ["source", "reference", "according to", "study", "published"]
            .iter()
            .any(|term| normalized.contains(term));
    let question_answer_pattern = questions > 0
        && ["answer", "how", "what", "why", "when"]
            .iter()
            .any(|term| normalized.contains(term));
    if words.len() < 150 {
        findings.push(ContentFinding { code:"content.thin", severity:"low", title:"Potentially thin content", evidence:serde_json::json!({"word_count":words.len()}), recommendation:"Add specific information that helps a visitor complete the page's primary task." });
    }
    if headings.is_empty() {
        findings.push(ContentFinding {
            code: "content.no_headings",
            severity: "medium",
            title: "No heading structure found",
            evidence: serde_json::json!({"headings":0}),
            recommendation: "Use a descriptive H1 and logical subheadings to organize the content.",
        });
    }
    if questions == 0 {
        findings.push(ContentFinding { code:"content.no_question_patterns", severity:"info", title:"No question-and-answer pattern detected", evidence:serde_json::json!({}), recommendation:"Where useful, answer customer questions directly with factual, reviewable language." });
    }
    if !offering_reference {
        findings.push(ContentFinding { code:"content.offering_clarity", severity:"low", title:"No clear product or service signal detected", evidence:serde_json::json!({"matched_terms":[]}), recommendation:"State the products, services, or outcomes this page offers in clear factual language." });
    }
    if !organization_reference {
        findings.push(ContentFinding { code:"content.organization_clarity", severity:"info", title:"Limited organization identity signal", evidence:serde_json::json!({}), recommendation:"Where relevant, identify the organization responsible for this information." });
    }
    if !contact_reference && (organization_reference || offering_reference) {
        findings.push(ContentFinding {
            code: "content.contact_clarity",
            severity: "info",
            title: "No contact signal detected",
            evidence: serde_json::json!({}),
            recommendation: "For business pages, make a reliable contact path easy to find.",
        });
    }
    ContentAnalysis {
        word_count: words.len(),
        sentence_count: sentences,
        question_count: questions,
        repeated_terms,
        readability: Readability {
            average_sentence_words: avg,
            estimated_grade: (avg * 0.4 + 5.0).min(18.0),
            limitation: "This is a deterministic sentence-length estimate, not a quality or ranking judgement.",
        },
        factual_signals: FactualSignals {
            organization_reference,
            location_reference,
            contact_reference,
            offering_reference,
            citation_or_reference_signal,
            question_answer_pattern,
        },
        findings,
    }
}
