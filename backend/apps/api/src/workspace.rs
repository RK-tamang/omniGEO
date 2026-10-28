//! Workspace data aggregation endpoint.
//!
//! Returns all workspace-scoped rows in a single payload so the Next.js
//! dashboard can render KPIs, charts, tables and lists without calling
//! dozens of individual endpoints.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{State},
    http::HeaderMap,
    routing::{get},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{error::ApiError, state::AppState};

/// ---- Auth -----------------------------------------------------------------

async fn require_auth(headers: &HeaderMap, state: &AppState) -> Result<Uuid, ApiError> {
    crate::auth::session_user(&state.pool, headers).await
}

/// ---- Request/Response types ----------------------------------------------

#[derive(FromRow, Serialize)]
pub struct WorkspaceRow {
    pub id: Uuid,
    pub name: String,
    pub plan: Option<String>,
    pub settings: Option<serde_json::Value>,
}

#[derive(FromRow, Serialize)]
pub struct DomainRow {
    pub id: Uuid,
    pub domain: String,
    pub is_primary: Option<bool>,
}

#[derive(FromRow, Serialize)]
pub struct PromptRow {
    pub id: Uuid,
    pub prompt: String,
    pub r#type: Option<String>,
    pub status: Option<String>,
    pub engines: Option<serde_json::Value>,
    pub target_prompt: Option<String>,
    pub sentiment: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(FromRow, Serialize)]
pub struct CitationRow {
    pub id: Uuid,
    pub prompt_id: Option<Uuid>,
    pub engine: String,
    pub domain: String,
    pub url: String,
    pub title: Option<String>,
    pub position: Option<i32>,
    pub captured_at: Option<DateTime<Utc>>,
}

#[derive(FromRow, Serialize)]
pub struct ContentItemRow {
    pub id: Uuid,
    pub title: String,
    pub status: Option<String>,
    pub score: Option<i32>,
    pub target_prompt: Option<String>,
    pub word_count: Option<i32>,
    pub citations: Option<i32>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(FromRow, Serialize)]
pub struct ScanRow {
    pub id: Uuid,
    pub r#type: Option<String>,
    pub status: Option<String>,
    pub score: Option<i32>,
    pub result: Option<serde_json::Value>,
    pub checks: Option<serde_json::Value>,
    pub pages_analyzed: Option<i32>,
    pub issues_found: Option<i32>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(FromRow, Serialize)]
pub struct CrawlRow {
    pub id: Uuid,
    pub url: String,
    pub status: Option<String>,
    pub pages_crawled: Option<i32>,
    pub result: Option<serde_json::Value>,
    pub created_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(FromRow, Serialize)]
pub struct AuditIssueRow {
    pub id: Uuid,
    pub category: String,
    pub severity: String,
    pub title: String,
    pub description: String,
    pub fix: String,
    pub pages_affected: Option<i32>,
    pub impact: Option<String>,
    pub effort: Option<String>,
    pub status: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(FromRow, Serialize)]
pub struct CompetitorRow {
    pub id: Uuid,
    pub name: String,
    pub domain: Option<String>,
    pub visibility_score: Option<i32>,
    pub citations_count: Option<i32>,
    pub prompts_won: Option<i32>,
    pub top_citations: Option<serde_json::Value>,
    pub last_checked_at: Option<DateTime<Utc>>,
}

#[derive(FromRow, Serialize)]
pub struct CompetitorPromptRow {
    pub id: Uuid,
    pub competitor_id: Uuid,
    pub prompt_id: Uuid,
    pub engine: String,
    pub status: String,
    pub position: Option<i32>,
    pub citation_url: Option<String>,
    pub captured_at: Option<DateTime<Utc>>,
}

#[derive(FromRow, Serialize)]
pub struct AlertRow {
    pub id: Uuid,
    pub r#type: String,
    pub severity: String,
    pub title: String,
    pub description: String,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(FromRow, Serialize)]
pub struct ReportRow {
    pub id: Uuid,
    pub name: String,
    pub r#type: String,
    pub format: Option<String>,
    pub status: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(FromRow, Serialize)]
pub struct WebhookRow {
    pub id: Uuid,
    pub url: String,
    pub events: Option<serde_json::Value>,
    pub active: Option<bool>,
    pub last_triggered_at: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct WorkspaceDataResponse {
    pub workspace: Option<WorkspaceRow>,
    pub domains: Vec<DomainRow>,
    pub prompts: Vec<PromptRow>,
    pub citations: Vec<CitationRow>,
    pub content_items: Vec<ContentItemRow>,
    pub scans: Vec<ScanRow>,
    pub crawls: Vec<CrawlRow>,
    pub audit_issues: Vec<AuditIssueRow>,
    pub competitors: Vec<CompetitorRow>,
    pub competitor_prompts: Vec<CompetitorPromptRow>,
    pub alerts: Vec<AlertRow>,
    pub reports: Vec<ReportRow>,
    pub webhooks: Vec<WebhookRow>,
}

/// GET /api/workspace/data
pub async fn get_workspace_data(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<WorkspaceDataResponse>, ApiError> {
    let _org_id = require_auth(&headers, &state).await?;

    let workspace = sqlx::query_as::<_, WorkspaceRow>(
        "SELECT id, name, plan, settings FROM organizations LIMIT 1",
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let domains = sqlx::query_as::<_, DomainRow>("SELECT id, domain, is_primary FROM domains ORDER BY domain")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;

    let prompts = sqlx::query_as::<_, PromptRow>(
        "SELECT id, prompt, type as r#type, status, engines, target_prompt, sentiment, created_at, updated_at FROM prompts ORDER BY created_at DESC LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let citations = sqlx::query_as::<_, CitationRow>(
        "SELECT id, prompt_id, engine, domain, url, title, position, captured_at FROM citations ORDER BY captured_at DESC LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let content_items = sqlx::query_as::<_, ContentItemRow>(
        "SELECT id, title, status, score, target_prompt, word_count, citations, updated_at FROM content_items ORDER BY updated_at DESC LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let scans = sqlx::query_as::<_, ScanRow>(
        "SELECT id, type as r#type, status, score, result, checks, pages_analyzed, issues_found, created_at FROM scans ORDER BY created_at DESC LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let crawls = sqlx::query_as::<_, CrawlRow>(
        "SELECT id, url, status, pages_crawled, result, created_at, completed_at FROM crawls ORDER BY created_at DESC LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let audit_issues = sqlx::query_as::<_, AuditIssueRow>(
        "SELECT id, category, severity, title, description, fix, pages_affected, impact, effort, status, created_at FROM audit_issues ORDER BY created_at DESC LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let competitors = sqlx::query_as::<_, CompetitorRow>(
        "SELECT id, name, domain, visibility_score, citations_count, prompts_won, top_citations, last_checked_at FROM competitors ORDER BY visibility_score DESC LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let competitor_prompts = sqlx::query_as::<_, CompetitorPromptRow>(
        "SELECT id, competitor_id, prompt_id, engine, status, position, citation_url, captured_at FROM competitor_prompts ORDER BY captured_at DESC LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let alerts = sqlx::query_as::<_, AlertRow>(
        "SELECT id, type as r#type, severity, title, description, created_at FROM alerts ORDER BY created_at DESC LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let reports = sqlx::query_as::<_, ReportRow>(
        "SELECT id, name, type as r#type, format, status, created_at FROM reports ORDER BY created_at DESC LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let webhooks = sqlx::query_as::<_, WebhookRow>(
        "SELECT id, url, events, active, last_triggered_at FROM webhooks ORDER BY last_triggered_at DESC NULLS LAST LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    Ok(Json(WorkspaceDataResponse {
        workspace,
        domains,
        prompts,
        citations,
        content_items,
        scans,
        crawls,
        audit_issues,
        competitors,
        competitor_prompts,
        alerts,
        reports,
        webhooks,
    }))
}

/// ---- Domain management ----

#[derive(Deserialize)]
struct DomainInput {
    domain: String,
    is_primary: Option<bool>,
}

#[derive(Serialize)]
struct DomainResponse {
    ok: bool,
    domain: String,
}

/// POST /api/domains
pub async fn post_domain(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<DomainInput>,
) -> Result<Json<DomainResponse>, ApiError> {
    let _user_id = require_auth(&headers, &state).await?;

    let domain = input.domain.trim().to_lowercase();
    let domain = domain.strip_prefix("https://").unwrap_or(&domain);
    let domain = domain.strip_prefix("http://").unwrap_or(domain);
    let domain = domain.strip_prefix("www.").unwrap_or(domain);
    let domain = domain.split('/').next().unwrap_or(domain).to_string();

    if domain.is_empty() {
        return Err(ApiError::Validation("Domain is required.".into()));
    }

    // Find or create a project for the first organization
    let org_id: Uuid = sqlx::query_scalar("SELECT id FROM organizations LIMIT 1")
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound)?;

    let project_id: Uuid = sqlx::query_scalar(
        "INSERT INTO projects(id, organization_id, name, created_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (id) DO NOTHING
         RETURNING id",
    )
    .bind(Uuid::new_v4())
    .bind(org_id)
    .bind("Default Project")
    .fetch_one(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    // Insert or update domain
    let is_primary = input.is_primary.unwrap_or(false);
    sqlx::query(
        "INSERT INTO domains(id, project_id, host, canonical_origin, created_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (project_id, host) DO UPDATE SET
           canonical_origin = EXCLUDED.canonical_origin,
           is_primary = EXCLUDED.is_primary",
    )
    .bind(Uuid::new_v4())
    .bind(project_id)
    .bind(&domain)
    .bind(format!("https://{}", domain))
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    Ok(Json(DomainResponse { ok: true, domain }))
}

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/workspace/data", get(get_workspace_data))
        // .route("/api/domains", post(post_domain))  // Temporarily disabled due to extractor type mismatch
}
