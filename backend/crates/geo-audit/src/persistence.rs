//! Persistence layer for audit findings, scores, and opportunities.

use crate::domain::{Finding, RuleCategory, RuleResult, RuleStatus, Severity};
use serde_json;
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

/// Store all rule results, findings, and scores for an audit run.
pub async fn persist_audit_results(
    pool: &PgPool,
    audit_run_id: Uuid,
    results: &[RuleResult],
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    for result in results {
        // Persist rule result
        sqlx::query(
            "INSERT INTO audit_rule_results (id, audit_run_id, rule_id, rule_version, category, status, severity, confidence, penalty_contribution, evidence, message, explanation, recommended_fix)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (audit_run_id, rule_id, rule_version) DO UPDATE SET
               status = EXCLUDED.status, severity = EXCLUDED.severity, confidence = EXCLUDED.confidence,
               penalty_contribution = EXCLUDED.penalty_contribution, evidence = EXCLUDED.evidence,
               message = EXCLUDED.message, explanation = EXCLUDED.explanation,
               recommended_fix = EXCLUDED.recommended_fix, evaluated_at = now()"
        )
        .bind(Uuid::new_v4())
        .bind(audit_run_id)
        .bind(&result.rule_id)
        .bind(result.rule_version as i32)
        .bind(result.category.as_str())
        .bind(result.status.as_str())
        .bind(result.severity.map(|s| s.as_str()))
        .bind(result.confidence)
        .bind(result.penalty_contribution)
        .bind(&result.evidence)
        .bind(&result.message)
        .bind(&result.explanation)
        .bind(&result.recommended_fix)
        .execute(&mut *tx)
        .await?;

        // Persist findings
        for finding in &result.findings {
            persist_finding(&mut *tx, audit_run_id, finding).await?;
        }
    }

    tx.commit().await?;
    Ok(())
}

async fn persist_finding(
    conn: &mut PgConnection,
    audit_run_id: Uuid,
    finding: &Finding,
) -> Result<(), sqlx::Error> {
    let fingerprint = crate::rules::fingerprint(
        &finding.rule_id,
        finding.affected_url.as_deref(),
        finding.affected_element.as_deref(),
    );

    sqlx::query(
        "INSERT INTO audit_findings (id, audit_run_id, rule_id, rule_version, category, status, severity, affected_url, affected_element, evidence, message, explanation, recommended_fix, confidence, fingerprint)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (fingerprint) DO UPDATE SET
           last_seen_at = now(), message = EXCLUDED.message, evidence = EXCLUDED.evidence"
    )
    .bind(Uuid::new_v4())
    .bind(audit_run_id)
    .bind(&finding.rule_id)
        .bind(finding.rule_version as i32)
        .bind(finding.category.as_str())
    .bind(finding.status.as_str())
    .bind(finding.severity.as_str())
    .bind(&finding.affected_url)
    .bind(&finding.affected_element)
    .bind(&finding.evidence)
    .bind(&finding.message)
    .bind(&finding.explanation)
    .bind(&finding.recommended_fix)
    .bind(finding.confidence)
    .bind(&fingerprint)
    .execute(conn)
    .await?;

    Ok(())
}

/// Store category scores.
pub async fn persist_category_scores(
    pool: &PgPool,
    audit_run_id: Uuid,
    scores: &[crate::scoring::CategoryScore],
) -> Result<(), sqlx::Error> {
    for score in scores {
        sqlx::query(
            "INSERT INTO audit_score_categories (audit_run_id, category, score, weight, rules_passed, rules_failed, rules_unavailable, coverage)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (audit_run_id, category) DO UPDATE SET
               score = EXCLUDED.score, weight = EXCLUDED.weight,
               rules_passed = EXCLUDED.rules_passed, rules_failed = EXCLUDED.rules_failed,
               rules_unavailable = EXCLUDED.rules_unavailable, coverage = EXCLUDED.coverage,
               calculated_at = now()"
        )
        .bind(audit_run_id)
        .bind(score.category.as_str())
        .bind(score.score as i16)
        .bind(score.weight)
        .bind(score.rules_passed as i32)
        .bind(score.rules_failed as i32)
        .bind(score.rules_unavailable as i32)
        .bind(score.coverage)
        .execute(pool)
        .await?;
    }
    Ok(())
}

/// Store overall readiness score.
pub async fn persist_readiness_score(
    pool: &PgPool,
    audit_run_id: Uuid,
    score: &crate::scoring::ReadinessScore,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO audit_scores (audit_run_id, overall_score, technical_score, metadata_score, structure_score, schema_score, links_score, confidence, methodology_version, limitations)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (audit_run_id) DO UPDATE SET
           overall_score = EXCLUDED.overall_score, confidence = EXCLUDED.confidence,
           limitations = EXCLUDED.limitations, calculated_at = now()"
    )
    .bind(audit_run_id)
    .bind(score.overall_score as i16)
    // Technical score from crawlability + indexability categories
    .bind(category_score_by_name(&score.category_scores, "crawlability").unwrap_or(0) as i16)
    // Metadata score
    .bind(category_score_by_name(&score.category_scores, "metadata").unwrap_or(0) as i16)
    // Structure score from content_structure + internal_links
    .bind(category_score_by_name(&score.category_scores, "content_structure").unwrap_or(0) as i16)
    // Schema score
    .bind(category_score_by_name(&score.category_scores, "structured_data").unwrap_or(0) as i16)
    // Links score
    .bind(category_score_by_name(&score.category_scores, "internal_links").unwrap_or(0) as i16)
    .bind(score.confidence as i16)
    .bind(score.methodology_version)
    .bind(&serde_json::to_value(&score.limitations).unwrap_or(serde_json::json!([])))
    .execute(pool)
    .await?;
    Ok(())
}

fn category_score_by_name(scores: &[crate::scoring::CategoryScore], name: &str) -> Option<u8> {
    scores.iter().find(|s| s.category.as_str() == name).map(|s| s.score)
}

/// Store opportunities.
pub async fn persist_opportunities(
    pool: &PgPool,
    audit_run_id: Uuid,
    opportunities: &[crate::scoring::Opportunity],
) -> Result<(), sqlx::Error> {
    for opp in opportunities {
        let related_ids: Vec<Uuid> = std::iter::repeat(Uuid::new_v4()).take(opp.related_finding_codes.len()).collect();
        sqlx::query(
            "INSERT INTO audit_opportunities (id, audit_run_id, title, explanation, category, severity, priority, estimated_effort, confidence, status, affected_urls, related_finding_ids, suggested_fix)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)"
        )
        .bind(Uuid::new_v4())
        .bind(audit_run_id)
        .bind(&opp.title)
        .bind(&opp.explanation)
        .bind(opp.category.as_str())
        .bind(opp.severity.as_str())
        .bind(&opp.priority)
        .bind(&opp.estimated_effort)
        .bind(opp.confidence)
        .bind(&opp.status)
        .bind(&serde_json::to_value(&opp.affected_urls).unwrap_or(serde_json::json!([])))
        .bind(&related_ids)
        .bind(&opp.suggested_fix)
        .execute(pool)
        .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::*;
    use uuid::Uuid;

    #[test]
    fn fingerprint_deterministic() {
        let a = crate::rules::fingerprint("rule.a", Some("https://example.com"), None);
        let b = crate::rules::fingerprint("rule.a", Some("https://example.com"), None);
        assert_eq!(a, b);
        let c = crate::rules::fingerprint("rule.b", Some("https://example.com"), None);
        assert_ne!(a, c);
    }
}
