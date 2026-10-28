use scraper::{Html, Selector};
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize)]
pub struct SchemaAnalysis {
    pub documents: usize,
    pub types: Vec<String>,
    pub findings: Vec<SchemaFinding>,
}
#[derive(Debug, Serialize)]
pub struct SchemaFinding {
    pub code: &'static str,
    pub severity: &'static str,
    pub title: String,
    pub evidence: Value,
    pub recommendation: &'static str,
    pub kind: &'static str,
}

pub fn analyze_json_ld(input: &str) -> SchemaAnalysis {
    let Ok(value) = serde_json::from_str::<Value>(input) else {
        return SchemaAnalysis {
            documents: 0,
            types: vec![],
            findings: vec![SchemaFinding {
                code: "schema.invalid_json",
                severity: "high",
                title: "Invalid JSON-LD syntax".into(),
                evidence: serde_json::json!({}),
                recommendation: "Correct the JSON syntax before relying on this markup.",
                kind: "formal",
            }],
        };
    };
    let nodes: Vec<&Value> = match &value {
        Value::Array(values) => values.iter().collect(),
        Value::Object(object) if object.get("@graph").and_then(Value::as_array).is_some() => object
            .get("@graph")
            .unwrap()
            .as_array()
            .unwrap()
            .iter()
            .collect(),
        _ => vec![&value],
    };
    let mut types = Vec::new();
    let mut findings = Vec::new();
    for node in &nodes {
        let type_name = schema_type_name(node.get("@type"));
        types.push(type_name.clone());
        if !node.is_object() {
            findings.push(SchemaFinding {
                code: "schema.invalid_node",
                severity: "high",
                title: "Structured-data node is not an object".into(),
                evidence: (*node).clone(),
                recommendation: "Use a JSON object for each schema entity.",
                kind: "formal",
            });
            continue;
        }
        if type_name == "Organization" && node.get("name").is_none() {
            findings.push(SchemaFinding {
                code: "schema.organization_name_missing",
                severity: "medium",
                title: "Organization is missing a name".into(),
                evidence: (*node).clone(),
                recommendation: "Add the verified organization name.",
                kind: "heuristic",
            });
        }
    }
    SchemaAnalysis {
        documents: nodes.len(),
        types,
        findings,
    }
}

/// Extracts markup without executing scripts. Microdata/RDFa extraction is intentionally
/// structural: it reports observed properties and leaves semantic validation explicit.
pub fn analyze_document(html: &str) -> Vec<SchemaAnalysis> {
    let document = Html::parse_document(html);
    let json_ld = Selector::parse("script[type='application/ld+json']").expect("static selector");
    let mut analyses: Vec<_> = document
        .select(&json_ld)
        .map(|node| analyze_json_ld(&node.text().collect::<String>()))
        .collect();
    let microdata = extract_microdata(&document);
    if !microdata.is_empty() {
        analyses.push(analyze_property_entities(microdata, "microdata"));
    }
    let rdfa = extract_rdfa(&document);
    if !rdfa.is_empty() {
        analyses.push(analyze_property_entities(rdfa, "rdfa"));
    }
    if analyses.is_empty() {
        analyses.push(SchemaAnalysis { documents: 0, types: vec![], findings: vec![SchemaFinding { code:"schema.not_found", severity:"info", title:"No structured data found".into(), evidence:serde_json::json!({}), recommendation:"Add accurate structured data only when it represents visible, verified page information.", kind:"heuristic" }] });
    }
    analyses
}

/// Extracts schema evidence into inert JSON values for shared crawl storage. Script text is
/// parsed as JSON and never executed. Microdata/RDFa are captured as declared type and literal
/// properties; `source` records the syntax that was observed.
pub fn extract_markup(document: &Html) -> Vec<Value> {
    let json_ld = Selector::parse("script[type='application/ld+json']").expect("static selector");
    let mut values: Vec<Value> = document.select(&json_ld).map(|node| {
        let raw=node.text().collect::<String>();
        match serde_json::from_str::<Value>(&raw) {
            Ok(value)=>serde_json::json!({"source":"json_ld","valid_json":true,"value":value}),
            Err(error)=>serde_json::json!({"source":"json_ld","valid_json":false,"error":error.to_string()}),
        }
    }).collect();
    values.extend(extract_microdata(document).into_iter().map(|mut node| {
        node["source"] = Value::String("microdata".into());
        node
    }));
    values.extend(extract_rdfa(document).into_iter().map(|mut node| {
        node["source"] = Value::String("rdfa".into());
        node
    }));
    values
}

fn extract_microdata(document: &Html) -> Vec<Value> {
    let selector = Selector::parse("[itemscope]").expect("static selector");
    let property_selector = Selector::parse("[itemprop]").expect("static selector");
    document
        .select(&selector)
        .map(|node| {
            let node_type = node
                .value()
                .attr("itemtype")
                .and_then(|value| value.rsplit('/').next())
                .unwrap_or("unknown");
            let mut properties = serde_json::Map::new();
            for property in node.select(&property_selector) {
                if let Some(name) = property.value().attr("itemprop") {
                    let value = property
                        .value()
                        .attr("content")
                        .or_else(|| property.value().attr("href"))
                        .map(str::to_owned)
                        .unwrap_or_else(|| {
                            property
                                .text()
                                .collect::<Vec<_>>()
                                .join(" ")
                                .trim()
                                .to_owned()
                        });
                    properties.insert(name.into(), Value::String(value));
                }
            }
            serde_json::json!({"@type":node_type,"properties":properties})
        })
        .collect()
}

fn extract_rdfa(document: &Html) -> Vec<Value> {
    let selector = Selector::parse("[typeof]").expect("static selector");
    let property_selector = Selector::parse("[property]").expect("static selector");
    document
        .select(&selector)
        .map(|node| {
            let node_type = node
                .value()
                .attr("typeof")
                .unwrap_or("unknown")
                .split_whitespace()
                .map(|kind| {
                    kind.rsplit(|ch| matches!(ch, '/' | '#' | ':'))
                        .next()
                        .unwrap_or(kind)
                })
                .collect::<Vec<_>>()
                .join(" ");
            let mut properties = serde_json::Map::new();
            for property in node.select(&property_selector) {
                if let Some(name) = property.value().attr("property") {
                    let value = property
                        .value()
                        .attr("content")
                        .or_else(|| property.value().attr("resource"))
                        .map(str::to_owned)
                        .unwrap_or_else(|| {
                            property
                                .text()
                                .collect::<Vec<_>>()
                                .join(" ")
                                .trim()
                                .to_owned()
                        });
                    properties.insert(name.into(), Value::String(value));
                }
            }
            serde_json::json!({"@type":node_type,"properties":properties})
        })
        .collect()
}

pub fn analyze_property_entities(nodes: Vec<Value>, _source: &str) -> SchemaAnalysis {
    let mut types = Vec::new();
    let mut findings = Vec::new();
    for node in &nodes {
        let type_name = schema_type_name(node.get("@type"));
        types.push(type_name.clone());
        let props = node.get("properties").and_then(Value::as_object);
        let has = |key: &str| {
            node.get(key).is_some() || props.is_some_and(|properties| properties.contains_key(key))
        };
        if matches!(
            type_name.as_str(),
            "Organization" | "LocalBusiness" | "Product" | "Article" | "FAQPage" | "BreadcrumbList"
        ) && !has("name")
            && !has("headline")
        {
            findings.push(SchemaFinding { code:"schema.recommended_name_missing", severity:"low", title:format!("{type_name} is missing an identifying property"), evidence:node.clone(), recommendation:"Add a verified name or headline property appropriate to the declared schema type.", kind:"heuristic" });
        }
        if type_name == "Product" && !has("offers") && !has("brand") {
            findings.push(SchemaFinding {code:"schema.product_context_missing",severity:"low",title:"Product context is incomplete".into(),evidence:node.clone(),recommendation:"Review whether verified product context such as brand or offers is appropriate.",kind:"heuristic"});
        }
        if type_name == "Article" && !has("author") {
            findings.push(SchemaFinding {
                code: "schema.article_author_missing",
                severity: "low",
                title: "Article author is not declared".into(),
                evidence: node.clone(),
                recommendation: "Declare an accurate author when the page represents an article.",
                kind: "heuristic",
            });
        }
        if type_name == "FAQPage" && !has("mainEntity") {
            findings.push(SchemaFinding {code:"schema.faq_entity_missing",severity:"medium",title:"FAQPage mainEntity is missing".into(),evidence:node.clone(),recommendation:"Represent each visible question and answer as the page's mainEntity only when applicable.",kind:"formal"});
        }
        if type_name == "BreadcrumbList" && !has("itemListElement") {
            findings.push(SchemaFinding {
                code: "schema.breadcrumb_items_missing",
                severity: "medium",
                title: "BreadcrumbList items are missing".into(),
                evidence: node.clone(),
                recommendation: "Include the ordered visible breadcrumb items.",
                kind: "formal",
            });
        }
    }
    SchemaAnalysis {
        documents: nodes.len(),
        types,
        findings,
    }
}

fn schema_type_name(value: Option<&Value>) -> String {
    let raw = value
        .and_then(Value::as_str)
        .or_else(|| {
            value
                .and_then(Value::as_array)
                .and_then(|items| items.first())
                .and_then(Value::as_str)
        })
        .unwrap_or("unknown");
    raw.rsplit(|ch| matches!(ch, '/' | '#' | ':'))
        .next()
        .unwrap_or(raw)
        .to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_json_and_reports_supported_type_suggestions() {
        let invalid = analyze_json_ld("{");
        assert_eq!(invalid.findings[0].code, "schema.invalid_json");
        let org = analyze_json_ld(r#"{"@context":"https://schema.org","@type":"Organization"}"#);
        assert_eq!(org.types, vec!["Organization"]);
        assert_eq!(org.findings[0].code, "schema.organization_name_missing");
    }

    #[test]
    fn extracts_json_ld_microdata_and_rdfa_without_script_execution() {
        let html = r#"<main><script type="application/ld+json">{"@type":"Article","headline":"Verified"}</script><div itemscope itemtype="https://schema.org/LocalBusiness"><span itemprop="name">Sample Shop</span></div><div typeof="Organization"><span property="name">Sample Shop</span></div><script>throw new Error('never run')</script></main>"#;
        let analyses = analyze_document(html);
        assert_eq!(analyses.len(), 3);
        assert!(analyses.iter().any(|analysis| {
            analysis
                .types
                .iter()
                .any(|kind| kind.ends_with("LocalBusiness"))
        }));
        assert!(analyses.iter().any(|analysis| {
            analysis
                .types
                .iter()
                .any(|kind| kind.contains("Organization"))
        }));
    }
}
