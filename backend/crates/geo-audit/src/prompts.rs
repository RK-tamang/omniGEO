use serde::Serialize;
use std::collections::BTreeSet;
#[derive(Serialize)]
pub struct PromptIdeas {
    pub suggestions: Vec<PromptIdea>,
    pub limitation: &'static str,
}
#[derive(Serialize)]
pub struct PromptIdea {
    pub prompt: String,
    pub category: &'static str,
}
pub fn generate(
    industry: &str,
    brand: Option<&str>,
    offerings: &[String],
    location: Option<&str>,
    audience: Option<&str>,
) -> PromptIdeas {
    let subject = offerings
        .first()
        .cloned()
        .unwrap_or_else(|| industry.to_owned());
    let place = location.map(|x| format!(" in {x}")).unwrap_or_default();
    let audience = audience.map(|x| format!(" for {x}")).unwrap_or_default();
    let mut set = BTreeSet::new();
    for (template, category) in [
        (
            "What should I look for when choosing {subject}{place}?",
            "informational",
        ),
        (
            "Which {subject} options are best{place}{audience}?",
            "recommendation",
        ),
        (
            "How does {subject} compare with alternatives{place}?",
            "comparison",
        ),
        (
            "What questions should I ask a {industry} provider{place}?",
            "commercial",
        ),
    ] {
        set.insert((
            template
                .replace("{subject}", &subject)
                .replace("{place}", &place)
                .replace("{audience}", &audience)
                .replace("{industry}", industry),
            category,
        ));
    }
    if let Some(brand) = brand {
        set.insert((format!("What does {brand} offer for {subject}?"), "brand"));
    }
    PromptIdeas {
        suggestions: set
            .into_iter()
            .map(|(prompt, category)| PromptIdea { prompt, category })
            .collect(),
        limitation: "Template-generated suggestions are not measured search demand or observed AI visibility.",
    }
}
