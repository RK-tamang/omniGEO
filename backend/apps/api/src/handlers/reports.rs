use std::{path::Path, sync::Arc};

use axum::{
    Json,
    body::Body,
    extract::{Path as PathParam, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{error::ApiError, services::audits::hash_access_token, state::AppState};

#[derive(Deserialize)]
pub struct CreateReportRequest {
    pub audit_id: Uuid,
    pub format: String,
    #[serde(default = "default_report_type")]
    pub report_type: String,
}
fn default_report_type() -> String {
    "geo_audit".into()
}

#[derive(Serialize)]
pub struct CreateReportResponse {
    pub report_id: Uuid,
    pub job_id: Uuid,
    pub status: &'static str,
    pub status_url: String,
}

pub async fn create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateReportRequest>,
) -> Result<(StatusCode, Json<CreateReportResponse>), ApiError> {
    authorize_audit(&state, input.audit_id, &headers).await?;
    if !["json", "csv", "pdf"].contains(&input.format.as_str()) {
        return Err(ApiError::Validation(
            "format must be json, csv, or pdf.".into(),
        ));
    }
    if ![
        "geo_audit",
        "technical_seo",
        "structured_data",
        "content_readiness",
        "sitemap_robots",
        "optimization_opportunities",
    ]
    .contains(&input.report_type.as_str())
    {
        return Err(ApiError::Validation(
            "Unsupported or unavailable report type.".into(),
        ));
    }
    let audit: Option<(String,Option<Uuid>)> = sqlx::query_as("SELECT a.status::text,p.organization_id FROM audit_runs a LEFT JOIN projects p ON p.id=a.project_id WHERE a.id=$1")
        .bind(input.audit_id).fetch_optional(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    let (audit_status, organization_id) = audit.ok_or(ApiError::NotFound)?;
    if !["completed", "partially_completed"].contains(&audit_status.as_str()) {
        return Err(ApiError::Validation(
            "Reports can be generated after an audit completes or partially completes.".into(),
        ));
    }
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|error| ApiError::Internal(error.into()))?;
    let usage: i64;
    if let Some(org_id) = organization_id {
        let entitlement:Option<(bool,i32)>=sqlx::query_as("SELECT reports_enabled,monthly_export_limit FROM organization_report_entitlements WHERE organization_id=$1 FOR UPDATE")
            .bind(org_id).fetch_optional(&mut *tx).await.map_err(|error|ApiError::Internal(error.into()))?;
        let (enabled, limit) = entitlement.ok_or_else(|| {
            ApiError::Validation("Report exports are not entitled for this organization.".into())
        })?;
        if !enabled {
            return Err(ApiError::Validation(
                "Report exports are not entitled for this organization.".into(),
            ));
        }
        usage=sqlx::query_scalar("SELECT (SELECT count(*) FROM export_usage_events WHERE organization_id=$1 AND created_at>=date_trunc('month',now()))+(SELECT count(*) FROM reports WHERE organization_id=$1 AND created_at>=date_trunc('month',now()) AND status IN ('queued','running'))")
            .bind(org_id).fetch_one(&mut *tx).await.map_err(|error|ApiError::Internal(error.into()))?;
        if usage >= i64::from(limit) {
            return Err(ApiError::Validation(
                "Monthly report export limit reached.".into(),
            ));
        }
    } else {
        // Serialize capability-token exports on the audit row and apply a small
        // configurable free allowance even when an audit has no workspace.
        sqlx::query("SELECT id FROM audit_runs WHERE id=$1 FOR UPDATE")
            .bind(input.audit_id)
            .execute(&mut *tx)
            .await
            .map_err(|error| ApiError::Internal(error.into()))?;
        usage=sqlx::query_scalar("SELECT (SELECT count(*) FROM export_usage_events WHERE audit_run_id=$1 AND created_at>=date_trunc('month',now()))+(SELECT count(*) FROM reports WHERE audit_run_id=$1 AND created_at>=date_trunc('month',now()) AND status IN ('queued','running'))")
            .bind(input.audit_id).fetch_one(&mut *tx).await.map_err(|error|ApiError::Internal(error.into()))?;
        if usage >= state.config.report_anonymous_monthly_limit {
            return Err(ApiError::Validation(
                "Monthly report export limit reached for this audit.".into(),
            ));
        }
    }
    let report_id = Uuid::new_v4();
    let job_id = Uuid::new_v4();
    sqlx::query("INSERT INTO reports (id,audit_run_id,format,report_type,status,organization_id) VALUES ($1,$2,$3,$4,'queued',$5)")
        .bind(report_id).bind(input.audit_id).bind(&input.format).bind(&input.report_type).bind(organization_id).execute(&mut *tx).await.map_err(|error|ApiError::Internal(error.into()))?;
    sqlx::query("INSERT INTO report_jobs (id,report_id,status) VALUES ($1,$2,'queued')")
        .bind(job_id)
        .bind(report_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| ApiError::Internal(error.into()))?;
    tx.commit()
        .await
        .map_err(|error| ApiError::Internal(error.into()))?;
    Ok((
        StatusCode::ACCEPTED,
        Json(CreateReportResponse {
            report_id,
            job_id,
            status: "queued",
            status_url: format!("/api/v1/reports/{report_id}"),
        }),
    ))
}

#[derive(Deserialize)]
pub struct ListReportsQuery {
    pub audit_id: Uuid,
    pub limit: Option<i64>,
}
#[derive(FromRow, Serialize)]
pub struct ReportSummary {
    pub id: Uuid,
    pub audit_run_id: Uuid,
    pub report_type: String,
    pub format: String,
    pub status: String,
    pub content_type: Option<String>,
    pub byte_size: Option<i64>,
    pub failure_reason: Option<String>,
    pub source_snapshot_sha256: Option<String>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub retained_until: DateTime<Utc>,
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListReportsQuery>,
) -> Result<Json<Vec<ReportSummary>>, ApiError> {
    authorize_audit(&state, query.audit_id, &headers).await?;
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let reports=sqlx::query_as("SELECT id,audit_run_id,report_type,format,status,content_type,byte_size,failure_reason,source_snapshot_sha256,created_at,completed_at,retained_until FROM reports WHERE audit_run_id=$1 ORDER BY created_at DESC LIMIT $2")
        .bind(query.audit_id).bind(limit).fetch_all(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    Ok(Json(reports))
}

#[derive(FromRow)]
struct ReportRecord {
    id: Uuid,
    audit_run_id: Uuid,
    report_type: String,
    format: String,
    status: String,
    content_type: Option<String>,
    byte_size: Option<i64>,
    failure_reason: Option<String>,
    source_snapshot_sha256: Option<String>,
    created_at: DateTime<Utc>,
    completed_at: Option<DateTime<Utc>>,
    retained_until: DateTime<Utc>,
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    PathParam(report_id): PathParam<Uuid>,
) -> Result<Json<ReportSummary>, ApiError> {
    let report = load_report(&state, report_id).await?;
    authorize_audit(&state, report.audit_run_id, &headers).await?;
    Ok(Json(ReportSummary {
        id: report.id,
        audit_run_id: report.audit_run_id,
        report_type: report.report_type,
        format: report.format,
        status: report.status,
        content_type: report.content_type,
        byte_size: report.byte_size,
        failure_reason: report.failure_reason,
        source_snapshot_sha256: report.source_snapshot_sha256,
        created_at: report.created_at,
        completed_at: report.completed_at,
        retained_until: report.retained_until,
    }))
}

pub async fn download(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    PathParam(report_id): PathParam<Uuid>,
) -> Result<Response, ApiError> {
    let report = load_report(&state, report_id).await?;
    authorize_audit(&state, report.audit_run_id, &headers).await?;
    if report.status != "completed" {
        return Err(ApiError::Validation(format!(
            "Report is {} and is not downloadable yet.",
            report.status
        )));
    }
    let artifact: Option<(String,String,String,i64)> = sqlx::query_as("SELECT storage_key,content_type,checksum_sha256,byte_size FROM report_artifacts WHERE report_id=$1 AND retained_until > now()")
        .bind(report_id).fetch_optional(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    let (storage_key, content_type, checksum, byte_size) = artifact.ok_or(ApiError::NotFound)?;
    if Path::new(&storage_key)
        .file_name()
        .and_then(|name| name.to_str())
        != Some(storage_key.as_str())
    {
        return Err(ApiError::Internal(anyhow::anyhow!(
            "invalid report storage key"
        )));
    }
    let path = state.config.report_storage_dir.join(&storage_key);
    let bytes = std::fs::read(&path).map_err(|error| ApiError::Internal(error.into()))?;
    let digest = Sha256::digest(&bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    if digest != checksum || bytes.len() as i64 != byte_size {
        return Err(ApiError::Internal(anyhow::anyhow!(
            "stored report integrity check failed"
        )));
    }
    let content_type =
        HeaderValue::from_str(&content_type).map_err(|error| ApiError::Internal(error.into()))?;
    let disposition = HeaderValue::from_str(&format!(
        "attachment; filename=answerscope-report-{}.{}",
        report_id, report.format
    ))
    .map_err(|error| ApiError::Internal(error.into()))?;
    Ok((
        [
            (header::CONTENT_TYPE, content_type),
            (header::CONTENT_DISPOSITION, disposition),
        ],
        Body::from(bytes),
    )
        .into_response())
}

async fn load_report(state: &AppState, report_id: Uuid) -> Result<ReportRecord, ApiError> {
    sqlx::query_as("SELECT id,audit_run_id,report_type,format,status,content_type,byte_size,failure_reason,source_snapshot_sha256,created_at,completed_at,retained_until FROM reports WHERE id=$1")
        .bind(report_id).fetch_optional(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?.ok_or(ApiError::NotFound)
}

async fn authorize_audit(
    state: &AppState,
    audit_id: Uuid,
    headers: &HeaderMap,
) -> Result<(), ApiError> {
    let raw = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or(ApiError::Unauthorized)?;
    if raw.len() > 128 {
        return Err(ApiError::Unauthorized);
    }
    let token_hash = hash_access_token(raw);
    let allowed:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM audit_access_tokens WHERE audit_run_id=$1 AND token_hash=$2 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()))")
        .bind(audit_id).bind(token_hash).fetch_one(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    if allowed {
        Ok(())
    } else {
        Err(ApiError::Unauthorized)
    }
}
