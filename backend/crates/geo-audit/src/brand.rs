use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct BrandAnalysis {
    pub brand_name: String,
    pub aliases_checked: Vec<String>,
    pub occurrences: Vec<BrandOccurrence>,
    pub schema_organization_names: Vec<String>,
    pub contact_signals: ContactSignals,
    pub findings: Vec<BrandFinding>,
    pub limitation: &'static str,
}
#[derive(Debug, Serialize)]
pub struct BrandOccurrence {
    pub alias: String,
    pub count: usize,
}
#[derive(Debug, Serialize)]
pub struct ContactSignals {
    pub email_present: bool,
    pub telephone_present: bool,
    pub address_present: bool,
}
#[derive(Debug, Serialize)]
pub struct BrandFinding {
    pub code: &'static str,
    pub severity: &'static str,
    pub title: &'static str,
    pub evidence: serde_json::Value,
    pub recommendation: &'static str,
}

pub fn analyze(
    visible_text: &str,
    schema_names: Vec<String>,
    brand_name: &str,
    aliases: &[String],
) -> BrandAnalysis {
    let mut names = vec![brand_name.trim().to_owned()];
    names.extend(
        aliases
            .iter()
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty()),
    );
    names.sort();
    names.dedup();
    let haystack = visible_text.to_ascii_lowercase();
    let occurrences = names
        .iter()
        .map(|alias| BrandOccurrence {
            alias: alias.clone(),
            count: haystack.match_indices(&alias.to_ascii_lowercase()).count(),
        })
        .collect::<Vec<_>>();
    let email_present = visible_text.contains('@');
    let telephone_present = ["tel:", "phone", "telephone", "+1", "+44"]
        .iter()
        .any(|token| haystack.contains(token));
    let address_present = ["address", "street", "avenue", "road", "suite", "postal"]
        .iter()
        .any(|token| haystack.contains(token));
    let mut findings = Vec::new();
    if occurrences.first().is_none_or(|entry| entry.count == 0) {
        findings.push(BrandFinding { code:"brand.name_not_observed",severity:"medium",title:"Brand name was not observed in visible page text",evidence:serde_json::json!({"brand_name":brand_name}),recommendation:"Confirm that the verified brand name appears clearly on important site pages." });
    }
    let normalized_brand = brand_name.to_ascii_lowercase();
    let conflicting: Vec<_> = schema_names
        .iter()
        .filter(|name| !name.eq_ignore_ascii_case(brand_name))
        .cloned()
        .collect();
    if !conflicting.is_empty() {
        findings.push(BrandFinding { code:"brand.schema_name_mismatch",severity:"medium",title:"Organization schema name differs from supplied brand",evidence:serde_json::json!({"brand_name":brand_name,"schema_names":conflicting}),recommendation:"Review whether the visible brand and Organization schema represent the same verified entity." });
    }
    if schema_names.is_empty() {
        findings.push(BrandFinding { code:"brand.organization_schema_missing",severity:"info",title:"No Organization schema name found",evidence:serde_json::json!({"brand_name":normalized_brand}),recommendation:"Consider Organization or LocalBusiness markup only when the represented details are verified and visible." });
    }
    BrandAnalysis {
        brand_name: brand_name.into(),
        aliases_checked: names,
        occurrences,
        schema_organization_names: schema_names,
        contact_signals: ContactSignals {
            email_present,
            telephone_present,
            address_present,
        },
        findings,
        limitation: "This checks only the submitted page's rendered text and extracted markup. It does not verify external knowledge graphs, directories, or consumer AI answers.",
    }
}
