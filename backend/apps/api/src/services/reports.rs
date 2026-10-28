use std::{fs, fs::File, fs::OpenOptions, io::Write, path::Path};

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use answerscope_reporting::render::{
    self, ReadinessScore, ReportDocument, ReportFinding, ReportOpportunity,
};

#[derive(FromRow)]
struct ClaimedJob {
    id: Uuid,
    report_id: Uuid,
}
#[derive(FromRow)]
struct ReportSource {
    audit_run_id: Uuid,
    report_type: String,
    format: String,
    organization_id: Option<Uuid>,
    project_id: Option<Uuid>,
    project_name: Option<String>,
}
#[derive(FromRow)]
struct AuditSource {
    canonical_url: String,
    status: String,
    created_at: DateTime<Utc>,
    completed_at: Option<DateTime<Utc>>,
    failure_reason: Option<String>,
    page_limit: i32,
}
#[derive(FromRow)]
struct ScoreSource {
    overall_score: i16,
    technical_score: i16,
    metadata_score: i16,
    structure_score: i16,
    schema_score: i16,
    links_score: i16,
    confidence: i16,
    crawl_budget_utilization: i16,
    evidence_categories: Value,
    methodology_version: String,
    methodology_description: Option<String>,
    methodology_weights: Option<Value>,
}
#[derive(FromRow)]
struct FindingSource {
    code: String,
    severity: String,
    title: String,
    affected_url: Option<String>,
    evidence: Value,
    recommendation: String,
}
#[derive(FromRow)]
struct OpportunitySource {
    priority: i16,
    title: String,
    evidence: Value,
    recommendation: String,
    affected_url: Option<String>,
}

#[derive(Serialize, serde::Deserialize)]
struct SourceSnapshot {
    report: ReportDocument,
    format: String,
    source_audit_id: Uuid,
    organization_id: Option<Uuid>,
    audit_completed_at: Option<DateTime<Utc>>,
}

/// Claim and build one report job. Report artifacts are private files in the configured storage
/// directory; only the authorized HTTP handler can retrieve them.
pub async fn process_next(pool: &PgPool, storage_dir: &Path, worker_id: &str) -> Result<bool> {
    sqlx::query("UPDATE report_jobs SET status='queued',locked_by=NULL,lease_expires_at=NULL,available_at=now() WHERE status='running' AND lease_expires_at < now()")
        .execute(pool).await?;
    let claimed: Option<ClaimedJob> = sqlx::query_as("WITH candidate AS (SELECT id FROM report_jobs WHERE status='queued' AND available_at<=now() ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE report_jobs j SET status='running',attempts=attempts+1,locked_by=$1,lease_expires_at=now()+interval '10 minutes' FROM candidate WHERE j.id=candidate.id RETURNING j.id,j.report_id")
        .bind(worker_id).fetch_optional(pool).await?;
    let Some(job) = claimed else { return Ok(false) };
    sqlx::query("UPDATE reports SET status='running',failure_reason=NULL WHERE id=$1")
        .bind(job.report_id)
        .execute(pool)
        .await?;
    match build_report(pool, storage_dir, job.report_id).await {
        Ok(()) => Ok(true),
        Err(error) => {
            tracing::error!(%error,report_id=%job.report_id,"report generation failed");
            let message = "Report generation failed. Please retry or contact support.";
            sqlx::query("UPDATE reports SET status='failed',failure_reason=$2,completed_at=now() WHERE id=$1")
                .bind(job.report_id).bind(message).execute(pool).await?;
            sqlx::query("UPDATE report_jobs SET status='failed',last_error=$2,completed_at=now(),lease_expires_at=NULL,locked_by=NULL WHERE id=$1")
                .bind(job.id).bind(message).execute(pool).await?;
            Ok(true)
        }
    }
}

async fn build_report(pool: &PgPool, storage_dir: &Path, report_id: Uuid) -> Result<()> {
    let saved: Option<Value> =
        sqlx::query_scalar("SELECT source_snapshot FROM reports WHERE id=$1")
            .bind(report_id)
            .fetch_one(pool)
            .await?;
    let source: SourceSnapshot = if let Some(snapshot) = saved {
        let digest = hex_sha256(&serde_json::to_vec(&snapshot)?);
        sqlx::query("UPDATE reports SET source_snapshot_sha256=COALESCE(source_snapshot_sha256,$2) WHERE id=$1")
            .bind(report_id).bind(digest).execute(pool).await?;
        serde_json::from_value(snapshot).context("stored report snapshot is invalid")?
    } else {
        let fresh = load_consistent_snapshot(pool, report_id).await?;
        let snapshot_json = serde_json::to_value(&fresh)?;
        let digest = hex_sha256(&serde_json::to_vec(&snapshot_json)?);
        sqlx::query("UPDATE reports SET source_snapshot=COALESCE(source_snapshot,$2),source_snapshot_sha256=COALESCE(source_snapshot_sha256,$3) WHERE id=$1")
            .bind(report_id).bind(snapshot_json).bind(digest).execute(pool).await?;
        let saved: Value = sqlx::query_scalar("SELECT source_snapshot FROM reports WHERE id=$1")
            .bind(report_id)
            .fetch_one(pool)
            .await?;
        serde_json::from_value(saved).context("stored report snapshot is invalid")?
    };

    let (content_type, bytes) = render::render(&source.format, &source.report)?;
    let max_bytes: i64 = if let Some(organization_id) = source.organization_id {
        sqlx::query_scalar("SELECT max_artifact_bytes FROM organization_report_entitlements WHERE organization_id=$1 AND reports_enabled")
            .bind(organization_id).fetch_optional(pool).await?.context("report entitlement was revoked before generation")?
    } else {
        25_000_000
    };
    if bytes.len() as i64 > max_bytes {
        anyhow::bail!("report artifact exceeded the configured export size limit");
    }
    let checksum = hex_sha256(&bytes);
    fs::create_dir_all(storage_dir).context("create report artifact directory")?;
    set_private_directory(storage_dir)?;
    let extension = format_extension(&content_type);
    let storage_key = format!("{report_id}.{extension}");
    let final_path = storage_dir.join(&storage_key);
    let temp_path = storage_dir.join(format!(".{report_id}.{}.tmp", Uuid::new_v4()));
    let mut file = private_file(&temp_path)?;
    file.write_all(&bytes).context("write report artifact")?;
    file.sync_all().context("sync report artifact")?;
    drop(file);
    fs::rename(&temp_path, &final_path).context("commit report artifact")?;

    let mut tx = pool.begin().await?;
    sqlx::query("INSERT INTO report_artifacts (report_id,storage_key,content_type,byte_size,checksum_sha256,retained_until) SELECT id,$2,$3,$4,$5,retained_until FROM reports WHERE id=$1 ON CONFLICT(report_id) DO UPDATE SET storage_key=EXCLUDED.storage_key,content_type=EXCLUDED.content_type,byte_size=EXCLUDED.byte_size,checksum_sha256=EXCLUDED.checksum_sha256,retained_until=EXCLUDED.retained_until")
        .bind(report_id).bind(&storage_key).bind(&content_type).bind(bytes.len() as i64).bind(&checksum).execute(&mut *tx).await?;
    sqlx::query("UPDATE reports SET status='completed',storage_key=$2,content_type=$3,byte_size=$4,checksum_sha256=$5,completed_at=now(),failure_reason=NULL WHERE id=$1")
        .bind(report_id).bind(&storage_key).bind(&content_type).bind(bytes.len() as i64).bind(&checksum).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO export_usage_events (audit_run_id,report_id,format,byte_size,organization_id) SELECT audit_run_id,id,format,$2,organization_id FROM reports WHERE id=$1")
        .bind(report_id).bind(bytes.len() as i64).execute(&mut *tx).await?;
    sqlx::query("UPDATE report_jobs SET status='completed',completed_at=now(),lease_expires_at=NULL,locked_by=NULL,last_error=NULL WHERE report_id=$1")
        .bind(report_id).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO notifications(user_id,organization_id,notification_type,title,body,action_url,data) SELECT m.user_id,r.organization_id,'report.completed','Report ready','Your requested audit report is ready to download.','/reports/'||r.id::text,jsonb_build_object('report_id',r.id) FROM reports r JOIN memberships m ON m.organization_id=r.organization_id WHERE r.id=$1 AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=m.user_id AND n.notification_type='report.completed' AND n.data->>'report_id'=r.id::text)")
        .bind(report_id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(())
}

async fn load_consistent_snapshot(pool: &PgPool, report_id: Uuid) -> Result<SourceSnapshot> {
    let mut tx = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        .execute(&mut *tx)
        .await?;
    let source: ReportSource=sqlx::query_as("SELECT r.audit_run_id,r.report_type,r.format,r.organization_id,a.project_id,p.name AS project_name FROM reports r JOIN audit_runs a ON a.id=r.audit_run_id LEFT JOIN projects p ON p.id=a.project_id WHERE r.id=$1")
        .bind(report_id).fetch_optional(&mut *tx).await?.context("report row disappeared")?;
    let audit: AuditSource=sqlx::query_as("SELECT canonical_url,status::text,created_at,completed_at,failure_reason,page_limit FROM audit_runs WHERE id=$1")
        .bind(source.audit_run_id).fetch_optional(&mut *tx).await?.context("audit row disappeared")?;
    let score: Option<ScoreSource>=sqlx::query_as("SELECT s.overall_score,s.technical_score,s.metadata_score,s.structure_score,s.schema_score,s.links_score,s.confidence,s.crawl_budget_utilization,s.evidence_categories,s.methodology_version,v.description AS methodology_description,v.weights AS methodology_weights FROM audit_scores s LEFT JOIN audit_rule_versions v ON v.id=s.methodology_version WHERE s.audit_run_id=$1")
        .bind(source.audit_run_id).fetch_optional(&mut *tx).await?;
    let page_count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM crawled_pages WHERE audit_run_id=$1")
            .bind(source.audit_run_id)
            .fetch_one(&mut *tx)
            .await?;
    let raw_findings: Vec<FindingSource>=sqlx::query_as("SELECT code,severity,title,COALESCE(affected_url,evidence->>'url') AS affected_url,evidence,recommendation FROM audit_findings WHERE audit_run_id=$1 ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,created_at")
        .bind(source.audit_run_id).fetch_all(&mut *tx).await?;
    let opportunities: Vec<OpportunitySource> = if source.report_type
        == "optimization_opportunities"
    {
        sqlx::query_as("SELECT o.priority,o.title,o.evidence,o.recommendation,f.affected_url FROM opportunities o LEFT JOIN audit_findings f ON f.id=o.source_finding_id WHERE o.audit_run_id=$1 ORDER BY o.priority DESC,o.created_at").bind(source.audit_run_id).fetch_all(&mut *tx).await?
    } else {
        Vec::new()
    };
    let brand_aliases: Vec<String> = if let Some(project_id) = source.project_id {
        sqlx::query_scalar("SELECT alias FROM project_brand_aliases WHERE project_id=$1 ORDER BY is_primary DESC,alias").bind(project_id).fetch_all(&mut *tx).await?
    } else {
        Vec::new()
    };
    tx.commit().await?;

    let findings: Vec<ReportFinding> = raw_findings
        .into_iter()
        .filter(|finding| matches_type(&source.report_type, &finding.code))
        .map(|finding| ReportFinding {
            code: finding.code,
            severity: finding.severity,
            title: finding.title,
            affected_url: finding.affected_url,
            evidence: finding.evidence,
            recommendation: finding.recommendation,
        })
        .collect();
    let methodology=score.as_ref().map(|score|{
        let description=score.methodology_description.as_deref().unwrap_or("Versioned audit scoring methodology.");
        let weights=score.methodology_weights.as_ref().map(Value::to_string).unwrap_or_else(||"weights unavailable".into());
        format!("{description} Registered weights: {weights}. The score is not an AI visibility metric.")
    }).unwrap_or_else(||"GEO Readiness is derived from saved audit evidence; this report does not measure AI visibility.".into());
    let score = score.map(|score| ReadinessScore {
        overall: score.overall_score.clamp(0, 100) as u8,
        technical: score.technical_score.clamp(0, 100) as u8,
        metadata: score.metadata_score.clamp(0, 100) as u8,
        content_structure: score.structure_score.clamp(0, 100) as u8,
        schema: score.schema_score.clamp(0, 100) as u8,
        internal_links: score.links_score.clamp(0, 100) as u8,
        confidence: score.confidence.clamp(0, 100) as u8,
        crawl_budget_utilization: score.crawl_budget_utilization.clamp(0, 100) as u8,
        evidence_categories: score.evidence_categories,
        methodology_version: score.methodology_version,
    });
    let mut limitations = vec![
        "The audit covers only pages discovered within its configured crawl scope.".into(),
        "GEO Readiness is derived website evidence and does not measure consumer AI visibility."
            .into(),
    ];
    if page_count < audit.page_limit as i64 {
        limitations.push(format!(
            "{} of {} configured crawl pages were observed.",
            page_count, audit.page_limit
        ));
    }
    if let Some(reason) = audit.failure_reason {
        limitations.push(format!("Audit coverage note: {reason}"));
    }
    let opportunities: Vec<ReportOpportunity> = opportunities
        .into_iter()
        .map(|item| ReportOpportunity {
            priority: item.priority,
            title: item.title,
            affected_url: item.affected_url,
            evidence: item.evidence,
            recommendation: item.recommendation,
        })
        .collect();
    let high_priority = findings
        .iter()
        .filter(|f| matches!(f.severity.as_str(), "critical" | "high"))
        .count();
    let summary = format!(
        "{} audit: {} pages crawled, {} findings, including {} high or critical, and {} evidence-backed opportunities.",
        audit.status,
        page_count,
        findings.len(),
        high_priority,
        opportunities.len()
    );
    let report = ReportDocument {
        report_type: source.report_type,
        project_name: source.project_name,
        brand_aliases,
        domain: audit.canonical_url,
        configured_page_limit: audit.page_limit.max(0) as usize,
        audit_status: audit.status,
        summary,
        audit_started_at: Some(audit.created_at),
        audit_completed_at: audit.completed_at,
        generated_at: Utc::now(),
        readiness_score: score,
        crawled_pages: page_count as usize,
        findings,
        opportunities,
        coverage_limitations: limitations,
        methodology,
    };
    Ok(SourceSnapshot {
        report,
        format: source.format,
        source_audit_id: source.audit_run_id,
        organization_id: source.organization_id,
        audit_completed_at: audit.completed_at,
    })
}

fn matches_type(report_type: &str, code: &str) -> bool {
    match report_type {
        "technical_seo" => [
            "http.",
            "metadata.",
            "canonical.",
            "robots.",
            "headings.",
            "indexing.",
            "links.",
        ]
        .iter()
        .any(|prefix| code.starts_with(prefix)),
        "structured_data" => code.starts_with("schema."),
        "content_readiness" => code.starts_with("content.") || code.starts_with("headings."),
        "sitemap_robots" => code.starts_with("robots.") || code.starts_with("sitemap."),
        _ => true,
    }
}
fn format_extension(content_type: &str) -> &'static str {
    if content_type.starts_with("application/pdf") {
        "pdf"
    } else if content_type.starts_with("text/csv") {
        "csv"
    } else {
        "json"
    }
}
fn hex_sha256(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn set_private_directory(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .context("restrict report artifact directory permissions")?;
    }
    Ok(())
}
fn private_file(path: &Path) -> Result<File> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(path).context("create private report artifact")
}

pub async fn cleanup_expired(pool: &PgPool, storage_dir: &Path) -> Result<usize> {
    let rows:Vec<(Uuid,String)>=sqlx::query_as("SELECT report_id,storage_key FROM report_artifacts WHERE retained_until<=now() ORDER BY retained_until LIMIT 100").fetch_all(pool).await?;
    let mut removed = 0;
    for (report_id, key) in rows {
        if Path::new(&key).file_name().and_then(|name| name.to_str()) != Some(key.as_str()) {
            tracing::error!(%report_id,"invalid report storage key during retention cleanup");
            continue;
        }
        match fs::remove_file(storage_dir.join(&key)) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                tracing::warn!(%report_id,%error,"could not remove expired report artifact");
                continue;
            }
        }
        let mut tx = pool.begin().await?;
        sqlx::query("DELETE FROM report_artifacts WHERE report_id=$1 AND retained_until<=now()")
            .bind(report_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE reports SET status='expired',storage_key=NULL,content_type=NULL,byte_size=NULL,checksum_sha256=NULL,source_snapshot=NULL,source_snapshot_sha256=NULL WHERE id=$1 AND retained_until<=now()").bind(report_id).execute(&mut *tx).await?;
        tx.commit().await?;
        removed += 1;
    }
    Ok(removed)
}
