//! Deterministic body-text similarity helpers. Results are heuristic signals, not proof of
//! duplicate intent or search-engine canonicalization.
use std::collections::HashSet;

pub fn normalized_tokens(text: &str) -> HashSet<String> {
    text.split_whitespace()
        .map(|word| {
            word.trim_matches(|ch: char| !ch.is_alphanumeric())
                .to_lowercase()
        })
        .filter(|word| !word.is_empty())
        .collect()
}

pub fn jaccard_similarity(left: &HashSet<String>, right: &HashSet<String>) -> Option<f64> {
    if left.len() < 30 || right.len() < 30 {
        return None;
    }
    let union = left.union(right).count();
    (union > 0).then(|| left.intersection(right).count() as f64 / union as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_exact_and_near_duplicate_text() {
        let first = normalized_tokens(
            &(0..40)
                .map(|n| format!("term{n}"))
                .collect::<Vec<_>>()
                .join(" "),
        );
        let same = first.clone();
        let mut changed = first.clone();
        changed.remove("term39");
        changed.insert("replacement".into());
        assert_eq!(jaccard_similarity(&first, &same), Some(1.0));
        assert!(jaccard_similarity(&first, &changed).unwrap() > 0.95);
    }

    #[test]
    fn skips_small_pages_and_reports_dissimilar_text() {
        let short = normalized_tokens("too few words to compare");
        let full = normalized_tokens(
            &(0..40)
                .map(|n| format!("alpha{n}"))
                .collect::<Vec<_>>()
                .join(" "),
        );
        let other = normalized_tokens(
            &(0..40)
                .map(|n| format!("beta{n}"))
                .collect::<Vec<_>>()
                .join(" "),
        );
        assert_eq!(jaccard_similarity(&short, &full), None);
        assert_eq!(jaccard_similarity(&full, &other), Some(0.0));
    }
}
