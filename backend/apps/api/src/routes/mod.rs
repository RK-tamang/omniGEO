use std::{
    collections::{HashSet, VecDeque},
    sync::Arc,
};

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderName, HeaderValue, Method, StatusCode, header},
    routing::{delete, get, post},
};
use chrono::{DateTime, Utc};
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

use crate::{
    crawler::{robots::RobotsDocument, safe_url::CanonicalUrl, worker::CrawlEngine},
    error::ApiError,
    state::AppState,
};

fn normalize_tool_output(analyzer_id: &str, mut output: serde_json::Value) -> serde_json::Value {
    if let Some(items) = output.as_array_mut() {
        for item in items.iter_mut() {
            *item = normalize_tool_output(analyzer_id, item.clone());
        }
        return serde_json::json!({"analyzer_id":analyzer_id,"analyzer_version":"1.1.0","evaluation_status":"evaluated","results":output});
    }
    let Some(root) = output.as_object_mut() else {
        return serde_json::json!({"analyzer_id":analyzer_id,"analyzer_version":"1.1.0","evaluation_status":"evaluated","result":output});
    };
    root.insert(
        "analyzer_id".into(),
        serde_json::Value::String(analyzer_id.into()),
    );
    root.insert(
        "analyzer_version".into(),
        serde_json::Value::String("1.1.0".into()),
    );
    root.insert(
        "evaluation_status".into(),
        serde_json::Value::String("evaluated".into()),
    );
    for key in [
        "findings",
        "opportunities",
        "weakly_linked_pages",
        "broken_targets",
        "redirecting_targets",
        "broken_internal",
        "redirecting_internal",
        "external_failures",
        "crawlers",
        "checked_urls",
        "errors",
        "suggestions",
        "exact_title_groups",
        "exact_description_groups",
        "similar_metadata_groups",
        "near_duplicate_content",
    ] {
        if let Some(items) = root.get_mut(key).and_then(serde_json::Value::as_array_mut) {
            for item in items {
                let original = item.clone();
                if let Some(fields) = item.as_object_mut() {
                    let evidence = fields.get("evidence").cloned().unwrap_or(original);
                    let url = fields
                        .get("affected_url")
                        .cloned()
                        .or_else(|| fields.get("url").cloned())
                        .or_else(|| fields.get("target_url").cloned())
                        .or_else(|| {
                            fields
                                .get("evidence")
                                .and_then(|value| value.get("url"))
                                .cloned()
                        })
                        .unwrap_or(serde_json::Value::Null);
                    let explanation = fields
                        .get("explanation")
                        .cloned()
                        .or_else(|| fields.get("title").cloned())
                        .or_else(|| fields.get("message").cloned())
                        .unwrap_or_else(|| {
                            serde_json::Value::String("Observed analyzer result.".into())
                        });
                    let code = fields.get("code").cloned().unwrap_or_else(|| {
                        serde_json::Value::String(format!("{analyzer_id}.observation"))
                    });
                    let action = fields
                        .get("recommendation")
                        .cloned()
                        .or_else(|| fields.get("action").cloned())
                        .unwrap_or(serde_json::Value::Null);
                    let severity = fields.get("severity").cloned().unwrap_or_else(|| {
                        if fields.get("error").is_some() || fields.get("message").is_some() {
                            serde_json::Value::String("medium".into())
                        } else {
                            serde_json::Value::String("info".into())
                        }
                    });
                    let status = if fields.get("error").is_some() || fields.get("message").is_some()
                    {
                        serde_json::Value::String("unavailable".into())
                    } else {
                        serde_json::Value::String("evaluated".into())
                    };
                    fields
                        .entry("analyzer_id")
                        .or_insert_with(|| serde_json::Value::String(analyzer_id.into()));
                    fields
                        .entry("analyzer_version")
                        .or_insert_with(|| serde_json::Value::String("1.1.0".into()));
                    fields.entry("finding_code").or_insert(code);
                    fields.entry("severity").or_insert(severity);
                    fields.entry("affected_url").or_insert(url);
                    fields.entry("evidence").or_insert(evidence);
                    fields.entry("explanation").or_insert(explanation);
                    fields.entry("recommended_action").or_insert(action);
                    fields.entry("evaluation_status").or_insert(status);
                    fields
                        .entry("documentation_reference")
                        .or_insert(serde_json::Value::Null);
                }
            }
        }
    }
    if let Some(warnings) = root.get("warnings").and_then(serde_json::Value::as_array) {
        if !warnings.is_empty() {
            let findings=warnings.iter().map(|warning|serde_json::json!({"analyzer_id":analyzer_id,"analyzer_version":"1.1.0","finding_code":format!("{analyzer_id}.warning"),"severity":"low","affected_url":null,"evidence":{"warning":warning},"explanation":warning,"recommended_action":"Review the warning and correct the source configuration when appropriate.","evaluation_status":"evaluated","documentation_reference":null})).collect::<Vec<_>>();
            root.insert("findings".into(), serde_json::Value::Array(findings));
        }
    }
    if let Some(warnings) = root
        .get("document")
        .and_then(|value| value.get("warnings"))
        .and_then(serde_json::Value::as_array)
    {
        if !warnings.is_empty() {
            let mut findings=warnings.iter().map(|warning|serde_json::json!({"analyzer_id":analyzer_id,"analyzer_version":"1.1.0","finding_code":format!("{analyzer_id}.warning"),"severity":"low","affected_url":null,"evidence":{"warning":warning},"explanation":warning,"recommended_action":"Review the warning and correct the source configuration when appropriate.","evaluation_status":"evaluated","documentation_reference":null})).collect::<Vec<_>>();
            if let Some(existing) = root.get("findings").and_then(serde_json::Value::as_array) {
                findings.extend(existing.iter().cloned());
            }
            root.insert("findings".into(), serde_json::Value::Array(findings));
        }
    }
    output
}

macro_rules! analysis_run_wrapper {
    ($name:ident,$handler:ident,$request:ty,$analyzer:literal) => {
        async fn $name(
            State(state): State<Arc<AppState>>,
            headers: HeaderMap,
            Json(input): Json<$request>,
        ) -> Result<Json<serde_json::Value>, ApiError> {
            let request_value =
                serde_json::to_value(&input).map_err(|error| ApiError::Internal(error.into()))?;
            if let Some(audit_id) = request_value
                .get("audit_id")
                .and_then(serde_json::Value::as_str)
                .and_then(|value| Uuid::parse_str(value).ok())
            {
                authorize_audit_capability(&state, audit_id, &headers).await?;
            }
            let result = $handler(State(state), headers, Json(input)).await?;
            let value =
                serde_json::to_value(result.0).map_err(|error| ApiError::Internal(error.into()))?;
            Ok(Json(normalize_tool_output($analyzer, value)))
        }
    };
}

async fn authorize_audit_capability(
    state: &AppState,
    audit_id: Uuid,
    headers: &HeaderMap,
) -> Result<(), ApiError> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or(ApiError::Unauthorized)?;
    if token.len() > 128 {
        return Err(ApiError::Unauthorized);
    }
    let hash = crate::services::audits::hash_access_token(token);
    let allowed:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM audit_access_tokens WHERE audit_run_id=$1 AND token_hash=$2 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()))")
        .bind(audit_id).bind(hash).fetch_one(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    if allowed {
        Ok(())
    } else {
        Err(ApiError::Unauthorized)
    }
}

async fn geo_audit_run(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<GeoAuditRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    let (status, result) = submit_geo_audit(State(state), headers, Json(input)).await?;
    let value = serde_json::to_value(result.0).map_err(|error| ApiError::Internal(error.into()))?;
    Ok((status, Json(normalize_tool_output("geo_audit", value))))
}

pub fn router(state: Arc<AppState>) -> Router {
    let allowed_origin = state
        .config
        .frontend_origin
        .parse::<HeaderValue>()
        .expect("validated FRONTEND_ORIGIN must be a valid HTTP header value");
    Router::new()
        .route("/health", get(crate::handlers::system::health))
        .route("/ready", get(crate::handlers::system::ready))
        // Backwards-compatible aliases used by existing deployment probes.
        .route("/healthz", get(crate::handlers::system::health))
        .route("/readyz", get(crate::handlers::system::ready))
        .route(
            "/api/v1/system/info",
            get(crate::handlers::system::system_info),
        )
        .route(
            "/api/v1/openapi.json",
            get(crate::handlers::system::openapi),
        )
        .route("/api/v1/audits", post(create_audit).get(list_audits))
        .route("/api/v1/audits/{audit_id}", get(get_audit))
        .route("/api/v1/audits/{audit_id}/progress", get(get_audit_progress))
        .route("/api/v1/audits/{audit_id}/summary", get(get_audit_summary))
        .route("/api/v1/audits/{audit_id}/scores", get(get_audit_scores))
        .route("/api/v1/audits/{audit_id}/pages", get(list_pages))
        .route("/api/v1/audits/{audit_id}/findings", get(list_findings))
        .route("/api/v1/audits/{audit_id}/opportunities", get(get_audit_opportunities))
        .route("/api/v1/jobs", get(list_jobs))
        .route("/api/v1/jobs/{job_id}", get(get_job))
        .route("/api/v1/jobs/{job_id}/results", get(get_job_results))
        .route("/api/v1/jobs/{job_id}", delete(cancel_job))
        .route("/api/v1/tools/geo-audit", post(submit_geo_audit))
        .route(
            "/api/v1/tools/geo-audit/{audit_id}/results",
            get(geo_audit_results),
        )
        .route("/api/v1/tools/robots-analyze", post(robots_analyze))
        .route("/api/v1/tools/sitemap-analyze", post(sitemap_analyze))
        .route("/api/v1/tools/ai-crawler-check", post(ai_crawler_check))
        .route("/api/v1/tools/meta-analyze", post(meta_analyze))
        .route("/api/v1/tools/content-analyze", post(content_analyze))
        .route("/api/v1/tools/brand-analyze", post(brand_analyze))
        .route("/api/v1/tools/performance", post(performance_analyze))
        .route("/api/v1/tools/broken-links", post(broken_links_analyze))
        .route(
            "/api/v1/tools/duplicate-content",
            post(duplicate_content_analyze),
        )
        .route("/api/v1/tools/opportunities", post(opportunities_analyze))
        .route(
            "/api/v1/tools/report",
            post(crate::handlers::reports::create),
        )
        .route(
            "/api/v1/reports",
            post(crate::handlers::reports::create).get(crate::handlers::reports::list),
        )
        .route(
            "/api/v1/reports/{report_id}",
            get(crate::handlers::reports::get),
        )
        .route(
            "/api/v1/reports/{report_id}/download",
            get(crate::handlers::reports::download),
        )
        .route(
            "/api/v1/integrations/availability",
            get(integration_availability),
        )
        .route("/api/v1/tools/schema-validate", post(schema_validate))
        .route("/api/v1/tools/prompt-ideas", post(prompt_ideas))
        // Technical GEO audit tool routes
        .route("/api/v1/tools/robots-analyzer", post(robots_analyzer))
        .route("/api/v1/tools/sitemap-analyzer", post(sitemap_analyzer_tool))
        .route("/api/v1/tools/schema-validator", post(schema_validator))
        .route("/api/v1/tools/meta-analyzer", post(meta_analyzer_tool))
        .route("/api/v1/tools/internal-links", post(internal_links_tool))
        .route("/api/v1/tools/indexability-check", post(indexability_check))
        // Stable run-oriented paths for the 15-tool free GEO suite. These use the
        // same analyzers and persisted audit snapshots as the legacy paths above.
        .route("/api/v1/tools/geo-audit/runs", post(geo_audit_run))
        .route("/api/v1/tools/ai-crawler/runs", post(ai_crawler_run))
        .route("/api/v1/tools/robots/runs", post(robots_run))
        .route("/api/v1/tools/sitemap/runs", post(sitemap_run))
        .route("/api/v1/tools/schema/runs", post(schema_run))
        .route("/api/v1/tools/meta/runs", post(meta_run))
        .route("/api/v1/tools/content/runs", post(content_run))
        .route("/api/v1/tools/brand/runs", post(brand_run))
        .route(
            "/api/v1/tools/internal-links/runs",
            post(internal_links_run),
        )
        .route("/api/v1/tools/performance/runs", post(performance_run))
        .route("/api/v1/tools/broken-links/runs", post(broken_links_run))
        .route(
            "/api/v1/tools/duplicate-content/runs",
            post(duplicate_content_run),
        )
        .route("/api/v1/tools/prompt-ideas/runs", post(prompt_ideas_run))
        .route("/api/v1/tools/opportunities/runs", post(opportunities_run))
        .route("/api/v1/tools/report-data/runs", post(report_data_run))
        // Settings
        .route("/api/v1/settings", get(get_settings).patch(patch_settings))
        // Contact
        .route("/api/v1/contact", post(create_contact))
        // Dashboard layout
        .route("/api/dashboard/layout", get(get_dashboard_layout).patch(patch_dashboard_layout))
        // Crawler bulk
        .route("/api/v1/crawler/bulk", post(bulk_crawl))
        .merge(crate::visibility::routes())
        .merge(crate::dataforseo_routes::routes())
        .merge(crate::billing::routes())
        .merge(crate::auth::routes())
        .merge(crate::notifications::routes())
        .merge(crate::admin::routes())
        .merge(crate::workspace::routes())
        .route("/api/crawler/robots", get(crawler_robots))
        .layer(
            CorsLayer::new()
                .allow_origin(allowed_origin)
                .allow_credentials(true)
                .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
                .allow_headers([
                    header::CONTENT_TYPE,
                    header::AUTHORIZATION,
                    HeaderName::from_static("x-csrf-token"),
                    HeaderName::from_static("x-request-id"),
                ])
                .expose_headers([
                    header::CONTENT_DISPOSITION,
                    HeaderName::from_static("x-request-id"),
                ]),
        )
        .layer(axum::middleware::from_fn(
            answerscope_observability::request_context,
        ))
        .fallback(not_found)
        .with_state(state)
}

async fn get_settings(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user_id = crate::auth::session_user(&state.pool, &headers).await?;
    let settings: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT settings FROM organizations WHERE id = (SELECT organization_id FROM memberships WHERE user_id = $1 LIMIT 1)",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(serde_json::json!({
        "settings": settings.unwrap_or(serde_json::json!({})),
    })))
}

async fn patch_settings(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user_id = crate::auth::session_user(&state.pool, &headers).await?;
    let org_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT organization_id FROM memberships WHERE user_id = $1 LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    let org_id = org_id.ok_or(ApiError::NotFound)?;
    let affected = sqlx::query(
        "UPDATE organizations SET settings = $1 WHERE id = $2",
    )
    .bind(input.clone())
    .bind(org_id)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    if affected.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "settings": input,
    })))
}

async fn create_contact(
    State(state): State<Arc<AppState>>,
    Json(input): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let name = input.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let email = input.get("email").and_then(|v| v.as_str()).unwrap_or("");
    let company = input.get("company").and_then(|v| v.as_str()).unwrap_or("");
    if name.is_empty() || email.is_empty() || company.is_empty() {
        return Err(ApiError::Validation("name, email, and company are required".into()));
    }
    let _ = sqlx::query(
        "INSERT INTO email_outbox(recipient, template_key, subject, payload, idempotency_key) VALUES($1, 'contact_form', 'New contact request', $2, $3)",
    )
    .bind(email.to_owned())
    .bind(input.clone())
    .bind(format!("contact:{}:{}", email, chrono::Utc::now().timestamp()))
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Contact request received",
    })))
}

async fn get_dashboard_layout(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user_id = crate::auth::session_user(&state.pool, &headers).await?;
    let layout: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT settings->'dashboard_layout' FROM organizations WHERE id = (SELECT organization_id FROM memberships WHERE user_id = $1 LIMIT 1)",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(serde_json::json!({
        "layout": layout.unwrap_or(serde_json::json!({})),
    })))
}

async fn patch_dashboard_layout(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user_id = crate::auth::session_user(&state.pool, &headers).await?;
    let org_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT organization_id FROM memberships WHERE user_id = $1 LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    let org_id = org_id.ok_or(ApiError::NotFound)?;
    let affected = sqlx::query(
        "UPDATE organizations SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{dashboard_layout}', $1, true) WHERE id = $2",
    )
    .bind(input.clone())
    .bind(org_id)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    if affected.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(Json(serde_json::json!({
        "success": true,
        "layout": input,
    })))
}

async fn bulk_crawl(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let _user_id = crate::auth::session_user(&state.pool, &headers).await?;
    let urls: Vec<String> = input.get("urls")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();
    if urls.is_empty() {
        return Err(ApiError::Validation("urls array is required".into()));
    }
    let crawl_id = Uuid::new_v4();
    let _ = sqlx::query(
        "INSERT INTO crawls (id, workspace_id, url, status, format, result, started_at, completed_at, created_at) VALUES($1, NULL, $2, 'queued', 'json', $3, now(), NULL, now())",
    )
    .bind(crawl_id)
    .bind(urls.join(","))
    .bind(serde_json::json!({"queued_urls": urls.len()}))
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(serde_json::json!({
        "success": true,
        "crawl_id": crawl_id,
        "pages": 0,
        "succeeded": 0,
        "failed": 0,
        "credits_used": 0,
        "data": [],
    })))
}

async fn not_found() -> ApiError {
    ApiError::NotFound
}

#[derive(Deserialize, Serialize)]
struct CreateAuditRequest {
    url: String,
    project_id: Option<Uuid>,
}
#[derive(Serialize)]
struct CreateAuditResponse {
    audit_id: Uuid,
    canonical_url: String,
    status: &'static str,
    access_token: String,
}

async fn create_audit(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateAuditRequest>,
) -> Result<(StatusCode, Json<CreateAuditResponse>), ApiError> {
    if let Some(project_id) = input.project_id {
        crate::auth::authorize_project(&state.pool, &headers, project_id, true).await?;
    }
    let response = enqueue_audit(&state, input.url, input.project_id, None).await?;
    Ok((
        StatusCode::ACCEPTED,
        Json(CreateAuditResponse {
            audit_id: response.audit_id,
            canonical_url: response.canonical_url,
            status: "queued",
            access_token: response.access_token,
        }),
    ))
}

struct EnqueuedAudit {
    audit_id: Uuid,
    job_id: Uuid,
    canonical_url: String,
    access_token: String,
}
async fn enqueue_audit(
    state: &AppState,
    requested_url: String,
    project_id: Option<Uuid>,
    max_pages: Option<usize>,
) -> Result<EnqueuedAudit, ApiError> {
    let queued = crate::services::audits::queue(
        &state.pool,
        &state.config,
        requested_url,
        project_id,
        max_pages,
    )
    .await
    .map_err(ApiError::Internal)?;
    Ok(EnqueuedAudit {
        audit_id: queued.audit_id,
        job_id: queued.job_id,
        canonical_url: queued.canonical_url,
        access_token: queued.access_token,
    })
}

#[derive(Deserialize, Serialize)]
struct GeoAuditRequest {
    url: String,
    project_id: Option<Uuid>,
    max_pages: Option<usize>,
    include_performance: Option<bool>,
}
#[derive(Serialize)]
struct GeoAuditSubmission {
    job_id: Uuid,
    audit_id: Uuid,
    status: &'static str,
    status_url: String,
    performance_requested: bool,
    canonical_url: String,
    access_token: String,
}
async fn submit_geo_audit(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<GeoAuditRequest>,
) -> Result<(StatusCode, Json<GeoAuditSubmission>), ApiError> {
    if let Some(project_id) = input.project_id {
        crate::auth::authorize_project(&state.pool, &headers, project_id, true).await?;
    }
    let queued = enqueue_audit(&state, input.url, input.project_id, input.max_pages).await?;
    Ok((
        StatusCode::ACCEPTED,
        Json(GeoAuditSubmission {
            job_id: queued.job_id,
            audit_id: queued.audit_id,
            status: "queued",
            status_url: format!("/api/v1/jobs/{}", queued.job_id),
            performance_requested: input.include_performance.unwrap_or(false),
            canonical_url: queued.canonical_url,
            access_token: queued.access_token,
        }),
    ))
}

#[derive(FromRow, Serialize)]
struct GeoReadinessScore {
    overall_score: i16,
    technical_score: i16,
    metadata_score: i16,
    structure_score: i16,
    schema_score: i16,
    links_score: i16,
    confidence: i16,
    crawl_budget_utilization: i16,
    evidence_categories: serde_json::Value,
    methodology_version: String,
    limitations: serde_json::Value,
    calculated_at: DateTime<Utc>,
}
#[derive(Serialize)]
struct GeoAuditResults {
    audit: AuditRun,
    readiness_score: Option<GeoReadinessScore>,
    finding_counts: serde_json::Value,
    methodology: &'static str,
}
async fn geo_audit_results(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(audit_id): Path<Uuid>,
) -> Result<Json<GeoAuditResults>, ApiError> {
    authorize_audit_capability(&state, audit_id, &headers).await?;
    let audit: AuditRun=sqlx::query_as("SELECT id, requested_url, canonical_url, status::text AS status, created_at, completed_at, failure_reason FROM audit_runs WHERE id=$1").bind(audit_id).fetch_optional(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?.ok_or(ApiError::NotFound)?;
    let readiness_score=sqlx::query_as("SELECT overall_score,technical_score,metadata_score,structure_score,schema_score,links_score,confidence,crawl_budget_utilization,evidence_categories,methodology_version,limitations,calculated_at FROM audit_scores WHERE audit_run_id=$1").bind(audit_id).fetch_optional(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    let finding_counts: serde_json::Value=sqlx::query_scalar("SELECT COALESCE(jsonb_object_agg(severity,total),'{}'::jsonb) FROM (SELECT severity,count(*)::int AS total FROM audit_findings WHERE audit_run_id=$1 GROUP BY severity) counts").bind(audit_id).fetch_one(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    Ok(Json(GeoAuditResults {
        audit,
        readiness_score,
        finding_counts,
        methodology: "GEO Readiness is a derived, versioned website-audit score: technical 30%, metadata 20%, content structure 20%, schema 15%, internal linking 15%. It is not AI Visibility Rate and does not measure consumer AI search results.",
    }))
}

#[derive(FromRow, Serialize)]
struct JobStatus {
    id: Uuid,
    audit_run_id: Uuid,
    status: String,
    attempts: i32,
    available_at: DateTime<Utc>,
    lease_expires_at: Option<DateTime<Utc>>,
    last_error: Option<String>,
    created_at: DateTime<Utc>,
    completed_at: Option<DateTime<Utc>>,
}
async fn list_jobs(
    State(_state): State<Arc<AppState>>,
    _headers: HeaderMap,
) -> Result<Json<Vec<JobStatus>>, ApiError> {
    Ok(Json(vec![]))
}

async fn get_job(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(job_id): Path<Uuid>,
) -> Result<Json<JobStatus>, ApiError> {
    let job:Option<JobStatus>=sqlx::query_as("SELECT id,audit_run_id,status::text AS status,attempts,available_at,lease_expires_at,last_error,created_at,completed_at FROM crawl_jobs WHERE id=$1")
        .bind(job_id).fetch_optional(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let job = job.ok_or(ApiError::NotFound)?;
    authorize_audit_capability(&state, job.audit_run_id, &headers).await?;
    Ok(Json(job))
}

#[derive(FromRow)]
struct JobAuditId {
    audit_run_id: Uuid,
}

async fn get_job_results(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(job_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let job: Option<JobAuditId> = sqlx::query_as("SELECT audit_run_id FROM crawl_jobs WHERE id=$1")
        .bind(job_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|error| ApiError::Internal(error.into()))?;
    let job = job.ok_or(ApiError::NotFound)?;
    authorize_audit_capability(&state, job.audit_run_id, &headers).await?;
    let audit: AuditRun = sqlx::query_as("SELECT id,requested_url,canonical_url,status::text AS status,created_at,completed_at,failure_reason FROM audit_runs WHERE id=$1")
        .bind(job.audit_run_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|error| ApiError::Internal(error.into()))?
        .ok_or(ApiError::NotFound)?;
    let pages: Vec<CrawledPage> = sqlx::query_as("SELECT id,url,final_url,canonical_url,status_code,content_type,title,meta_description,meta_robots,x_robots_tag,redirect_chain,word_count,fetched_at FROM crawled_pages WHERE audit_run_id=$1 ORDER BY url")
        .bind(job.audit_run_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|error| ApiError::Internal(error.into()))?;
    let findings: Vec<AuditFinding> = sqlx::query_as("SELECT id,analyzer_id,analyzer_version,code,severity,affected_url,title,evidence,recommendation,evaluation_status,documentation_reference,created_at FROM audit_findings WHERE audit_run_id=$1 ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,created_at")
        .bind(job.audit_run_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|error| ApiError::Internal(error.into()))?;
    let score: Option<GeoReadinessScore> = sqlx::query_as("SELECT overall_score,technical_score,metadata_score,structure_score,schema_score,links_score,confidence,crawl_budget_utilization,evidence_categories,methodology_version,limitations,calculated_at FROM audit_scores WHERE audit_run_id=$1")
        .bind(job.audit_run_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|error| ApiError::Internal(error.into()))?;
    Ok(Json(
        serde_json::json!({"job_id":job_id,"audit":audit,"readiness_score":score,"pages":pages,"findings":findings,"methodology":"GEO Readiness is derived from website audit evidence. It does not represent observed AI visibility."}),
    ))
}

async fn cancel_job(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(job_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let audit_id: Option<Uuid> =
        sqlx::query_scalar("SELECT audit_run_id FROM crawl_jobs WHERE id=$1")
            .bind(job_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|error| ApiError::Internal(error.into()))?;
    authorize_audit_capability(&state, audit_id.ok_or(ApiError::NotFound)?, &headers).await?;
    let affected = sqlx::query("UPDATE crawl_jobs SET status=CASE WHEN status='queued' THEN 'canceled'::job_status ELSE status END, cancel_requested_at=now(), completed_at=CASE WHEN status='queued' THEN now() ELSE completed_at END WHERE id=$1 AND status IN ('queued','running')")
        .bind(job_id).execute(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    if affected.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    sqlx::query("UPDATE audit_runs SET status='canceled'::audit_run_status, completed_at=now(), failure_reason='Canceled by request.' WHERE id=(SELECT audit_run_id FROM crawl_jobs WHERE id=$1) AND status='queued'")
        .bind(job_id).execute(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(sqlx::FromRow, Serialize)]
struct AuditRun {
    id: Uuid,
    requested_url: String,
    canonical_url: String,
    status: String,
    created_at: DateTime<Utc>,
    completed_at: Option<DateTime<Utc>>,
    failure_reason: Option<String>,
}
async fn get_audit(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(audit_id): Path<Uuid>,
) -> Result<Json<AuditRun>, ApiError> {
    authorize_audit_capability(&state, audit_id, &headers).await?;
    sqlx::query_as("SELECT id, requested_url, canonical_url, status::text AS status, created_at, completed_at, failure_reason FROM audit_runs WHERE id = $1")
        .bind(audit_id).fetch_optional(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?
        .map(Json).ok_or(ApiError::NotFound)
}

#[derive(FromRow, Serialize)]
struct CrawledPage {
    id: Uuid,
    url: String,
    final_url: Option<String>,
    canonical_url: Option<String>,
    status_code: Option<i32>,
    content_type: Option<String>,
    title: Option<String>,
    meta_description: Option<String>,
    meta_robots: Option<String>,
    x_robots_tag: Option<String>,
    redirect_chain: serde_json::Value,
    word_count: Option<i32>,
    fetched_at: DateTime<Utc>,
}

async fn list_pages(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(audit_id): Path<Uuid>,
) -> Result<Json<Vec<CrawledPage>>, ApiError> {
    authorize_audit_capability(&state, audit_id, &headers).await?;
    let rows = sqlx::query_as("SELECT id,url,final_url,canonical_url,status_code,content_type,title,meta_description,meta_robots,x_robots_tag,redirect_chain,word_count,fetched_at FROM crawled_pages WHERE audit_run_id=$1 ORDER BY url")
        .bind(audit_id)
        .fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(rows))
}

#[derive(FromRow, Serialize)]
struct AuditFinding {
    id: Uuid,
    analyzer_id: String,
    analyzer_version: String,
    code: String,
    severity: String,
    affected_url: Option<String>,
    title: String,
    evidence: serde_json::Value,
    recommendation: String,
    evaluation_status: String,
    documentation_reference: Option<String>,
    created_at: DateTime<Utc>,
}

async fn list_findings(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(audit_id): Path<Uuid>,
) -> Result<Json<Vec<AuditFinding>>, ApiError> {
    authorize_audit_capability(&state, audit_id, &headers).await?;
    let rows = sqlx::query_as("SELECT id,analyzer_id,analyzer_version,code,severity,affected_url,title,evidence,recommendation,evaluation_status,documentation_reference,created_at FROM audit_findings WHERE audit_run_id=$1 ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END, created_at")
        .bind(audit_id)
        .fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(rows))
}

fn select_attr(document: &Html, query: &str, attribute: &str) -> Option<String> {
    let selector = Selector::parse(query).ok()?;
    document
        .select(&selector)
        .next()?
        .value()
        .attr(attribute)
        .map(str::to_owned)
}

#[derive(Deserialize, Serialize)]
struct WebsiteToolRequest {
    url: String,
    path: Option<String>,
}

#[derive(Serialize)]
struct RobotsAnalysisResponse {
    evaluated_url: String,
    robots_url: String,
    http_status: u16,
    document: RobotsDocument,
    requested_path: Option<String>,
    evaluation: Option<crate::crawler::robots::AccessEvaluation>,
    limitation: &'static str,
}

async fn robots_analyze(
    State(state): State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(input): Json<WebsiteToolRequest>,
) -> Result<Json<RobotsAnalysisResponse>, ApiError> {
    let target = CanonicalUrl::parse(&input.url).map_err(ApiError::Validation)?;
    let parsed =
        url::Url::parse(target.as_str()).map_err(|error| ApiError::Internal(error.into()))?;
    let robots_url = format!("{}/robots.txt", parsed.origin().ascii_serialization());
    let page = CrawlEngine::with_cache(
        state.pool.clone(),
        state.config.crawl_response_byte_limit,
        state.config.crawl_request_timeout_secs,
        state.config.crawl_max_redirects,
        state.config.crawl_cache_ttl_secs,
    )
    .fetch_html(&robots_url)
    .await
    .map_err(ApiError::Internal)?;
    let document = RobotsDocument::parse(&page.body);
    let evaluation = input
        .path
        .as_deref()
        .map(|path| document.evaluate("AnswerScopeBot", path));
    Ok(Json(RobotsAnalysisResponse {
        evaluated_url: target.into_string(),
        robots_url: page.final_url,
        http_status: page.status.as_u16(),
        document,
        requested_path: input.path,
        evaluation,
        limitation: "Robots directives describe observed access permissions. They do not prove any crawler has visited this website.",
    }))
}

#[derive(Deserialize, Serialize)]
struct SitemapAnalyzeRequest {
    url: String,
    sitemap_url: Option<String>,
    max_urls: Option<usize>,
    audit_id: Option<Uuid>,
}
#[derive(Serialize)]
struct SitemapAnalysisResponse {
    root_sitemap_url: String,
    sitemap_documents: usize,
    url_entries: usize,
    duplicate_urls: Vec<String>,
    invalid_urls: Vec<String>,
    lastmod_missing: usize,
    checked_urls: Vec<SitemapUrlCheck>,
    warnings: Vec<String>,
    crawled_urls_missing_from_sitemap: Vec<String>,
    limitation: &'static str,
}
#[derive(Serialize)]
struct SitemapUrlCheck {
    url: String,
    status_code: Option<u16>,
    final_url: Option<String>,
    error: Option<String>,
}

async fn sitemap_analyze(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<SitemapAnalyzeRequest>,
) -> Result<Json<SitemapAnalysisResponse>, ApiError> {
    if let Some(audit_id) = input.audit_id {
        authorize_audit_capability(&state, audit_id, &headers).await?;
    }
    let site = CanonicalUrl::parse(&input.url).map_err(ApiError::Validation)?;
    let site_url =
        url::Url::parse(site.as_str()).map_err(|error| ApiError::Internal(error.into()))?;
    let root_host = site_url
        .host_str()
        .ok_or_else(|| ApiError::Validation("The URL needs a hostname.".into()))?
        .to_ascii_lowercase();
    let root = match input.sitemap_url {
        Some(value) => CanonicalUrl::parse(&value)
            .map_err(ApiError::Validation)?
            .into_string(),
        None => format!("{}/sitemap.xml", site_url.origin().ascii_serialization()),
    };
    let root_parsed = url::Url::parse(&root).map_err(|error| ApiError::Internal(error.into()))?;
    if !root_parsed
        .host_str()
        .is_some_and(|host| host.eq_ignore_ascii_case(&root_host))
    {
        return Err(ApiError::Validation(
            "The sitemap URL must use the audited website host.".into(),
        ));
    }
    let engine = CrawlEngine::with_cache(
        state.pool.clone(),
        state.config.crawl_response_byte_limit,
        state.config.crawl_request_timeout_secs,
        state.config.crawl_max_redirects,
        state.config.crawl_cache_ttl_secs,
    );
    let mut pending = VecDeque::from([(root.clone(), 0_u8)]);
    let mut seen_sitemaps = HashSet::new();
    let mut seen_urls = HashSet::new();
    let mut duplicates = Vec::new();
    let mut invalid_urls = Vec::new();
    let mut warnings = Vec::new();
    let mut urls = Vec::new();
    let mut lastmod_missing = 0;
    while let Some((sitemap, depth)) = pending.pop_front() {
        if !seen_sitemaps.insert(sitemap.clone()) {
            continue;
        }
        if seen_sitemaps.len() > 20 {
            warnings.push("Stopped after 20 sitemap documents to protect the crawl budget.".into());
            break;
        }
        let page = match engine.fetch_html(&sitemap).await {
            Ok(page) => page,
            Err(error) => {
                warnings.push(format!("Could not retrieve sitemap {sitemap}: {error}"));
                continue;
            }
        };
        if !page.status.is_success() {
            warnings.push(format!(
                "Sitemap {} returned HTTP {}.",
                page.final_url, page.status
            ));
            continue;
        }
        let document = crate::crawler::sitemap::parse(&page.body);
        warnings.extend(document.parse_warnings);
        let is_index = document.kind == crate::crawler::sitemap::SitemapKind::SitemapIndex;
        for entry in document.entries {
            if is_index && depth < 3 {
                if let Ok(next) = CanonicalUrl::parse(&entry.location) {
                    let same_host = url::Url::parse(next.as_str())
                        .ok()
                        .and_then(|url| url.host_str().map(str::to_owned))
                        .is_some_and(|host| host.eq_ignore_ascii_case(&root_host));
                    if same_host {
                        pending.push_back((next.into_string(), depth + 1));
                    } else {
                        invalid_urls.push(entry.location);
                    }
                } else {
                    invalid_urls.push(entry.location);
                }
                continue;
            }
            match CanonicalUrl::parse(&entry.location) {
                Ok(valid) => {
                    let value = valid.into_string();
                    if !url::Url::parse(&value)
                        .ok()
                        .and_then(|url| url.host_str().map(str::to_owned))
                        .is_some_and(|host| host.eq_ignore_ascii_case(&root_host))
                    {
                        invalid_urls.push(value);
                        continue;
                    }
                    if !seen_urls.insert(value.clone()) {
                        duplicates.push(value);
                    } else {
                        if entry.last_modified.is_none() {
                            lastmod_missing += 1;
                        }
                        urls.push(value);
                    }
                }
                Err(_) => invalid_urls.push(entry.location),
            }
        }
    }
    let mut checked_urls = Vec::new();
    for entry in urls.iter().take(input.max_urls.unwrap_or(25).clamp(1, 100)) {
        match engine.fetch_html(entry).await {
            Ok(page) => checked_urls.push(SitemapUrlCheck {
                url: entry.clone(),
                status_code: Some(page.status.as_u16()),
                final_url: Some(page.final_url),
                error: None,
            }),
            Err(error) => checked_urls.push(SitemapUrlCheck {
                url: entry.clone(),
                status_code: None,
                final_url: None,
                error: Some(error.to_string()),
            }),
        }
    }
    let crawled_urls_missing_from_sitemap = if let Some(audit_id) = input.audit_id {
        sqlx::query_scalar("SELECT url FROM crawled_pages WHERE audit_run_id=$1 AND status_code BETWEEN 200 AND 299 AND url <> ALL($2)").bind(audit_id).bind(&urls).fetch_all(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?
    } else {
        Vec::new()
    };
    Ok(Json(SitemapAnalysisResponse {
        root_sitemap_url: root,
        sitemap_documents: seen_sitemaps.len(),
        url_entries: urls.len(),
        duplicate_urls: duplicates,
        invalid_urls,
        lastmod_missing,
        checked_urls,
        warnings,
        crawled_urls_missing_from_sitemap,
        limitation: "Sitemap status checks are sampled within the requested budget. A sitemap URL is not proof that a search engine indexed it.",
    }))
}

#[derive(Deserialize, Serialize)]
struct AiCrawlerCheckRequest {
    url: String,
    path: Option<String>,
}
#[derive(Serialize)]
struct AiCrawlerCheckResponse {
    evaluated_url: String,
    robots_url: String,
    crawlers: Vec<AiCrawlerResult>,
    limitation: &'static str,
}
#[derive(Serialize)]
struct AiCrawlerResult {
    identifier: &'static str,
    category: &'static str,
    evaluation: crate::crawler::robots::AccessEvaluation,
}

async fn ai_crawler_check(
    State(state): State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(input): Json<AiCrawlerCheckRequest>,
) -> Result<Json<AiCrawlerCheckResponse>, ApiError> {
    let target = CanonicalUrl::parse(&input.url).map_err(ApiError::Validation)?;
    let parsed =
        url::Url::parse(target.as_str()).map_err(|error| ApiError::Internal(error.into()))?;
    let robots_url = format!("{}/robots.txt", parsed.origin().ascii_serialization());
    let page = CrawlEngine::with_cache(
        state.pool.clone(),
        state.config.crawl_response_byte_limit,
        state.config.crawl_request_timeout_secs,
        state.config.crawl_max_redirects,
        state.config.crawl_cache_ttl_secs,
    )
    .fetch_html(&robots_url)
    .await
    .map_err(ApiError::Internal)?;
    let document = RobotsDocument::parse(&page.body);
    let path = input.path.unwrap_or_else(|| parsed.path().to_owned());
    let crawlers = [
        ("GPTBot", "training"),
        ("ChatGPT-User", "user-initiated retrieval"),
        ("OAI-SearchBot", "search"),
        ("ClaudeBot", "training"),
        ("Claude-SearchBot", "search"),
        ("Google-Extended", "training control"),
        ("Googlebot", "web search"),
        ("PerplexityBot", "search"),
    ]
    .into_iter()
    .map(|(identifier, category)| AiCrawlerResult {
        identifier,
        category,
        evaluation: document.evaluate(identifier, &path),
    })
    .collect();
    Ok(Json(AiCrawlerCheckResponse {
        evaluated_url: target.into_string(),
        robots_url: page.final_url,
        crawlers,
        limitation: "Observed robots permissions do not prove access, indexing, training use, citation, or AI visibility.",
    }))
}

#[derive(Serialize)]
struct MetaAnalysisResponse {
    evaluated_url: String,
    redirect_chain: Vec<String>,
    status_code: u16,
    x_robots_tag: Option<String>,
    metadata: serde_json::Value,
    findings: Vec<InlineFinding>,
}
#[derive(Serialize)]
struct InlineFinding {
    code: &'static str,
    severity: &'static str,
    title: &'static str,
    evidence: serde_json::Value,
    recommendation: &'static str,
}

async fn meta_analyze(
    State(state): State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(input): Json<WebsiteToolRequest>,
) -> Result<Json<MetaAnalysisResponse>, ApiError> {
    let target = CanonicalUrl::parse(&input.url).map_err(ApiError::Validation)?;
    let page = CrawlEngine::with_cache(
        state.pool.clone(),
        state.config.crawl_response_byte_limit,
        state.config.crawl_request_timeout_secs,
        state.config.crawl_max_redirects,
        state.config.crawl_cache_ttl_secs,
    )
    .fetch_html(target.as_str())
    .await
    .map_err(ApiError::Internal)?;
    let document = Html::parse_document(&page.body);
    let title_selector = Selector::parse("title").expect("static CSS selector");
    let title = document
        .select(&title_selector)
        .next()
        .map(|node| node.text().collect::<Vec<_>>().join(" ").trim().to_owned())
        .filter(|value| !value.is_empty());
    let headings: Vec<String> = document
        .select(&Selector::parse("h1,h2,h3,h4,h5,h6").expect("static CSS selector"))
        .map(|node| {
            format!(
                "{}: {}",
                node.value().name(),
                node.text().collect::<Vec<_>>().join(" ").trim()
            )
        })
        .collect();
    let canonical = select_attr(&document, "link[rel='canonical']", "href").and_then(|value| {
        url::Url::parse(&page.final_url)
            .ok()?
            .join(&value)
            .ok()
            .map(|url| url.to_string())
    });
    let metadata = serde_json::json!({ "title":title, "description":select_attr(&document,"meta[name='description']", "content"), "canonical":canonical, "robots":select_attr(&document,"meta[name='robots']", "content"), "viewport":select_attr(&document,"meta[name='viewport']", "content"), "language":select_attr(&document,"html", "lang"), "open_graph": {"title":select_attr(&document,"meta[property='og:title']", "content"), "description":select_attr(&document,"meta[property='og:description']", "content"), "image":select_attr(&document,"meta[property='og:image']", "content")}, "headings":headings });
    let mut findings = Vec::new();
    if metadata.get("title").is_none_or(serde_json::Value::is_null) {
        findings.push(InlineFinding {
            code: "metadata.missing_title",
            severity: "medium",
            title: "Missing page title",
            evidence: serde_json::json!({"url":page.final_url}),
            recommendation: "Add a concise, accurate title for this page.",
        });
    }
    if metadata
        .get("description")
        .is_none_or(serde_json::Value::is_null)
    {
        findings.push(InlineFinding {
            code: "metadata.missing_description",
            severity: "low",
            title: "Missing meta description",
            evidence: serde_json::json!({"url":page.final_url}),
            recommendation: "Add a useful description of the page for search-result snippets.",
        });
    }
    if metadata
        .get("robots")
        .and_then(serde_json::Value::as_str)
        .is_some_and(|value| {
            value
                .to_ascii_lowercase()
                .split(',')
                .any(|directive| directive.trim() == "noindex")
        })
        || page.x_robots_tag.as_deref().is_some_and(|value| {
            value
                .to_ascii_lowercase()
                .split(',')
                .any(|directive| directive.trim() == "noindex")
        })
    {
        findings.push(InlineFinding {code:"indexing.noindex_observed",severity:"high",title:"Indexing directive contains noindex",evidence:serde_json::json!({"url":page.final_url,"meta_robots":metadata.get("robots"),"x_robots_tag":page.x_robots_tag}),recommendation:"Confirm that this page is intentionally excluded from search discovery."});
    }
    if metadata
        .get("viewport")
        .is_none_or(serde_json::Value::is_null)
    {
        findings.push(InlineFinding {
            code: "metadata.missing_viewport",
            severity: "medium",
            title: "Missing mobile viewport",
            evidence: serde_json::json!({"url":page.final_url}),
            recommendation: "Add a responsive viewport meta tag.",
        });
    }
    if title
        .as_ref()
        .is_some_and(|value| value.chars().count() > 60)
    {
        findings.push(InlineFinding { code:"metadata.title_long", severity:"low", title:"Title may be too long", evidence:serde_json::json!({"length":title.as_ref().map(|value|value.chars().count())}), recommendation:"Review the title for concise page-specific wording." });
    }
    if metadata
        .get("description")
        .and_then(serde_json::Value::as_str)
        .is_some_and(|value| value.chars().count() > 160)
    {
        findings.push(InlineFinding { code:"metadata.description_long", severity:"info", title:"Meta description is long", evidence:serde_json::json!({"length":metadata.get("description").and_then(serde_json::Value::as_str).map(|value|value.chars().count())}), recommendation:"Keep the description useful and specific without padding it with repeated terms." });
    }
    let h1_count = headings
        .iter()
        .filter(|heading| heading.starts_with("h1:"))
        .count();
    if h1_count == 0 {
        findings.push(InlineFinding {
            code: "headings.missing_h1",
            severity: "medium",
            title: "No H1 heading detected",
            evidence: serde_json::json!({"heading_count":headings.len()}),
            recommendation: "Add one clear primary heading that states the page topic.",
        });
    }
    if h1_count > 1 {
        findings.push(InlineFinding { code:"headings.multiple_h1", severity:"low", title:"Multiple H1 headings detected", evidence:serde_json::json!({"h1_count":h1_count}), recommendation:"Review whether multiple primary headings are intentional and semantically clear." });
    }
    if metadata
        .get("canonical")
        .and_then(serde_json::Value::as_str)
        .is_some_and(|value| url::Url::parse(value).is_err())
    {
        findings.push(InlineFinding {
            code: "canonical.invalid",
            severity: "medium",
            title: "Canonical URL is not absolute and valid",
            evidence: serde_json::json!({"canonical":metadata.get("canonical")}),
            recommendation: "Use a valid canonical URL and verify that it represents this page.",
        });
    }
    if metadata
        .get("open_graph")
        .and_then(|value| value.get("title"))
        .is_none_or(serde_json::Value::is_null)
    {
        findings.push(InlineFinding { code:"social.og_title_missing", severity:"info", title:"Open Graph title is missing", evidence:serde_json::json!({}), recommendation:"Add social metadata when controlled sharing previews are part of the page experience." });
    }
    Ok(Json(MetaAnalysisResponse {
        evaluated_url: page.final_url,
        redirect_chain: page.redirect_chain,
        status_code: page.status.as_u16(),
        x_robots_tag: page.x_robots_tag,
        metadata,
        findings,
    }))
}

#[derive(Deserialize, Serialize)]
struct ContentAnalyzeRequest {
    url: Option<String>,
    text: Option<String>,
    audit_id: Option<Uuid>,
}
async fn content_analyze(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<ContentAnalyzeRequest>,
) -> Result<Json<crate::geo_audit::content::ContentAnalysis>, ApiError> {
    if let Some(audit_id) = input.audit_id {
        authorize_audit_capability(&state, audit_id, &headers).await?;
    }
    let (text, headings) = match (input.url, input.text, input.audit_id) {
        (None, None, Some(audit_id)) => {
            let row: Option<(String, Vec<serde_json::Value>)> = sqlx::query_as("SELECT COALESCE(string_agg(e.main_text,' '),'') AS text, COALESCE(array_agg(p.headings),'{}') FROM crawled_pages p LEFT JOIN page_extractions e ON e.crawled_page_id=p.id WHERE p.audit_run_id=$1").bind(audit_id).fetch_optional(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
            let (text, _heading_data) = row.ok_or(ApiError::NotFound)?;
            let headings = _heading_data
                .into_iter()
                .flat_map(|value| value.as_array().cloned().unwrap_or_default())
                .filter_map(|value| {
                    value
                        .get("text")
                        .and_then(serde_json::Value::as_str)
                        .map(str::to_owned)
                })
                .collect();
            (text, headings)
        }
        (_, Some(text), _) => (text, Vec::new()),
        (Some(url), None, None) => {
            let target = CanonicalUrl::parse(&url).map_err(ApiError::Validation)?;
            let page = CrawlEngine::with_cache(
                state.pool.clone(),
                state.config.crawl_response_byte_limit,
                state.config.crawl_request_timeout_secs,
                state.config.crawl_max_redirects,
                state.config.crawl_cache_ttl_secs,
            )
            .fetch_html(target.as_str())
            .await
            .map_err(ApiError::Internal)?;
            let doc = Html::parse_document(&page.body);
            let selector = Selector::parse("h1,h2,h3,h4,h5,h6").expect("static selector");
            (
                crate::crawler::worker::extract_main_text(&doc),
                doc.select(&selector)
                    .map(|node| node.text().collect::<Vec<_>>().join(" "))
                    .collect(),
            )
        }
        (None, None, None) => {
            return Err(ApiError::Validation(
                "Provide URL, text, or audit_id.".into(),
            ));
        }
        (Some(url), None, Some(_)) => {
            return Err(ApiError::Validation(format!(
                "Choose either url ({url}) or audit_id, not both."
            )));
        }
    };
    Ok(Json(crate::geo_audit::content::analyze(&text, &headings)))
}

#[derive(Deserialize, Serialize)]
struct BrandAnalyzeRequest {
    url: Option<String>,
    audit_id: Option<Uuid>,
    brand_name: String,
    aliases: Option<Vec<String>>,
}
async fn brand_analyze(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<BrandAnalyzeRequest>,
) -> Result<Json<crate::geo_audit::brand::BrandAnalysis>, ApiError> {
    if let Some(audit_id) = input.audit_id {
        authorize_audit_capability(&state, audit_id, &headers).await?;
    }
    if input.brand_name.trim().is_empty() {
        return Err(ApiError::Validation("brand_name is required.".into()));
    }
    let (visible_text, mut schema_names) = if let Some(audit_id) = input.audit_id {
        let row: Option<(String, Vec<serde_json::Value>)> = sqlx::query_as("SELECT COALESCE(string_agg(concat_ws(' ',e.main_text,p.title,p.meta_description),' '),'') AS text, COALESCE(array_agg(p.structured_data),'{}') FROM crawled_pages p LEFT JOIN page_extractions e ON e.crawled_page_id=p.id WHERE p.audit_run_id=$1")
            .bind(audit_id).fetch_optional(&state.pool).await.map_err(|error| ApiError::Internal(error.into()))?;
        let (text, structured) = row.ok_or(ApiError::NotFound)?;
        let mut names = Vec::new();
        for value in structured {
            collect_schema_names(&value, &mut names);
        }
        (text, names)
    } else {
        let url = input
            .url
            .ok_or_else(|| ApiError::Validation("Provide url or audit_id.".into()))?;
        let target = CanonicalUrl::parse(&url).map_err(ApiError::Validation)?;
        let page = CrawlEngine::with_cache(
            state.pool.clone(),
            state.config.crawl_response_byte_limit,
            state.config.crawl_request_timeout_secs,
            state.config.crawl_max_redirects,
            state.config.crawl_cache_ttl_secs,
        )
        .fetch_html(target.as_str())
        .await
        .map_err(ApiError::Internal)?;
        let doc = Html::parse_document(&page.body);
        let visible = crate::crawler::worker::extract_main_text(&doc);
        let selector =
            Selector::parse("script[type='application/ld+json']").expect("static selector");
        let mut names = Vec::new();
        for script in doc.select(&selector) {
            if let Ok(value) =
                serde_json::from_str::<serde_json::Value>(&script.text().collect::<String>())
            {
                collect_schema_names(&value, &mut names);
            }
        }
        (visible, names)
    };
    schema_names.sort();
    schema_names.dedup();
    Ok(Json(crate::geo_audit::brand::analyze(
        &visible_text,
        schema_names,
        &input.brand_name,
        &input.aliases.unwrap_or_default(),
    )))
}

#[derive(Deserialize, Serialize)]
struct InternalLinksRequest {
    audit_id: Uuid,
    low_incoming_threshold: Option<i64>,
    check_external_links: Option<bool>,
}
#[derive(Serialize)]
struct InternalLinksResponse {
    audit_id: Uuid,
    pages_crawled: i64,
    internal_links: i64,
    external_links: i64,
    weakly_linked_pages: Vec<LinkPageIssue>,
    broken_targets: Vec<LinkTargetIssue>,
    redirecting_targets: Vec<LinkTargetIssue>,
    external_failures: Vec<LinkTargetIssue>,
    limitation: &'static str,
}
#[derive(FromRow, Serialize)]
struct LinkPageIssue {
    url: String,
    incoming_links: i64,
    depth: i32,
    recommendation: String,
}
#[derive(FromRow, Serialize)]
struct LinkTargetIssue {
    source_url: String,
    target_url: String,
    status_code: Option<i32>,
    final_url: Option<String>,
    redirect_chain: Option<serde_json::Value>,
}

async fn internal_links_analyze(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<InternalLinksRequest>,
) -> Result<Json<InternalLinksResponse>, ApiError> {
    authorize_audit_capability(&state, input.audit_id, &headers).await?;
    let audit_exists: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM audit_runs WHERE id=$1 AND status IN ('completed','partially_completed')",
    )
    .bind(input.audit_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|error| ApiError::Internal(error.into()))?;
    if audit_exists.is_none() {
        return Err(ApiError::Validation(
            "Use a completed or partially completed audit for link analysis.".into(),
        ));
    }
    let pages: i64 = sqlx::query_scalar("SELECT count(*) FROM crawled_pages WHERE audit_run_id=$1")
        .bind(input.audit_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|error| ApiError::Internal(error.into()))?;
    let internal: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM crawl_links WHERE audit_run_id=$1 AND is_internal",
    )
    .bind(input.audit_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|error| ApiError::Internal(error.into()))?;
    let external: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM crawl_links WHERE audit_run_id=$1 AND NOT is_internal",
    )
    .bind(input.audit_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|error| ApiError::Internal(error.into()))?;
    let threshold = input.low_incoming_threshold.unwrap_or(1).clamp(0, 20);
    let weakly_linked_pages: Vec<LinkPageIssue>=sqlx::query_as("SELECT p.url, count(l.id)::bigint AS incoming_links, p.depth, 'Add contextual internal links from relevant pages where this page is important to users.' AS recommendation FROM crawled_pages p LEFT JOIN crawl_links l ON l.audit_run_id=p.audit_run_id AND l.target_url=p.url AND l.is_internal WHERE p.audit_run_id=$1 AND p.status_code BETWEEN 200 AND 299 GROUP BY p.url,p.depth HAVING count(l.id) <= $2 ORDER BY p.depth DESC,p.url LIMIT 100").bind(input.audit_id).bind(threshold).fetch_all(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    let broken_targets: Vec<LinkTargetIssue>=sqlx::query_as("SELECT l.source_url,l.target_url,p.status_code,p.final_url,p.redirect_chain FROM crawl_links l LEFT JOIN crawled_pages p ON p.audit_run_id=l.audit_run_id AND p.url=l.target_url WHERE l.audit_run_id=$1 AND l.is_internal AND (p.status_code IS NULL OR p.status_code >= 400) ORDER BY l.source_url LIMIT 100").bind(input.audit_id).fetch_all(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    let redirecting_targets: Vec<LinkTargetIssue>=sqlx::query_as("SELECT l.source_url,l.target_url,p.status_code,p.final_url,p.redirect_chain FROM crawl_links l JOIN crawled_pages p ON p.audit_run_id=l.audit_run_id AND p.url=l.target_url WHERE l.audit_run_id=$1 AND l.is_internal AND (p.status_code BETWEEN 300 AND 399 OR p.redirect_chain <> '[]'::jsonb) ORDER BY l.source_url LIMIT 100").bind(input.audit_id).fetch_all(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    let mut external_failures = Vec::new();
    if input.check_external_links.unwrap_or(false) {
        let targets:Vec<(String,String)>=sqlx::query_as("SELECT source_url,target_url FROM crawl_links WHERE audit_run_id=$1 AND NOT is_internal ORDER BY target_url LIMIT 25").bind(input.audit_id).fetch_all(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
        let engine = CrawlEngine::with_cache(
            state.pool.clone(),
            state.config.crawl_response_byte_limit,
            state.config.crawl_request_timeout_secs,
            state.config.crawl_max_redirects,
            state.config.crawl_cache_ttl_secs,
        );
        for (source_url, target_url) in targets {
            match engine.fetch_html(&target_url).await {
                Ok(page) if page.status.is_success() => {}
                Ok(page) => external_failures.push(LinkTargetIssue {
                    source_url,
                    target_url,
                    status_code: Some(page.status.as_u16() as i32),
                    final_url: Some(page.final_url),
                    redirect_chain: Some(serde_json::json!(page.redirect_chain)),
                }),
                Err(_) => external_failures.push(LinkTargetIssue {
                    source_url,
                    target_url,
                    status_code: None,
                    final_url: None,
                    redirect_chain: None,
                }),
            }
        }
    }
    Ok(Json(InternalLinksResponse {
        audit_id: input.audit_id,
        pages_crawled: pages,
        internal_links: internal,
        external_links: external,
        weakly_linked_pages,
        broken_targets,
        redirecting_targets,
        external_failures,
        limitation: "Potential orphan pages are inferred only from this audit's crawl and sitemap coverage; pages outside the crawl scope may not be represented.",
    }))
}

#[derive(Deserialize, Serialize)]
struct PerformanceRequest {
    url: String,
    strategies: Option<Vec<String>>,
}
#[derive(Serialize)]
struct PerformanceResponse {
    evaluated_url: String,
    provider: &'static str,
    api_key_configured: bool,
    quota_exceeded: bool,
    runs: Vec<crate::integrations::pagespeed::PageSpeedRun>,
    errors: Vec<PerformanceError>,
    limitation: &'static str,
}
#[derive(Serialize)]
struct PerformanceError {
    strategy: String,
    message: String,
}
async fn performance_analyze(
    State(state): State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(input): Json<PerformanceRequest>,
) -> Result<Json<PerformanceResponse>, ApiError> {
    let target = CanonicalUrl::parse(&input.url).map_err(ApiError::Validation)?;
    let strategies = input
        .strategies
        .unwrap_or_else(|| vec!["mobile".into(), "desktop".into()]);
    let mut runs = Vec::new();
    let mut errors = Vec::new();
    for strategy in strategies
        .into_iter()
        .filter(|strategy| strategy == "mobile" || strategy == "desktop")
        .take(2)
    {
        match crate::integrations::pagespeed::run(
            target.as_str(),
            &strategy,
            state.config.pagespeed_api_key.as_deref(),
        )
        .await
        {
            Ok(run) => runs.push(run),
            Err(message) => errors.push(PerformanceError { strategy, message }),
        }
    }
    Ok(Json(PerformanceResponse {
        evaluated_url: target.into_string(),
        provider: "Google PageSpeed Insights API v5",
        api_key_configured: state.config.pagespeed_api_key.is_some(),
        quota_exceeded: errors
            .iter()
            .any(|error| error.message.starts_with("quota_exceeded:")),
        runs,
        errors,
        limitation: "Performance results are provider-collected lab/field measurements when available. They are not a guarantee of indexing, rankings, or AI visibility.",
    }))
}

#[derive(Deserialize, Serialize)]
struct BrokenLinksRequest {
    audit_id: Uuid,
    check_external: Option<bool>,
}
#[derive(Serialize)]
struct BrokenLinksResponse {
    broken_internal: Vec<LinkTargetIssue>,
    redirecting_internal: Vec<LinkTargetIssue>,
    external_checked: usize,
    external_failures: Vec<LinkTargetIssue>,
    limitation: &'static str,
}
async fn broken_links_analyze(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<BrokenLinksRequest>,
) -> Result<Json<BrokenLinksResponse>, ApiError> {
    authorize_audit_capability(&state, input.audit_id, &headers).await?;
    let broken_internal:Vec<LinkTargetIssue>=sqlx::query_as("SELECT l.source_url,l.target_url,p.status_code,p.final_url,p.redirect_chain FROM crawl_links l LEFT JOIN crawled_pages p ON p.audit_run_id=l.audit_run_id AND p.url=l.target_url WHERE l.audit_run_id=$1 AND l.is_internal AND (p.status_code IS NULL OR p.status_code >= 400) ORDER BY l.source_url LIMIT 500").bind(input.audit_id).fetch_all(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    let redirecting_internal:Vec<LinkTargetIssue>=sqlx::query_as("SELECT l.source_url,l.target_url,p.status_code,p.final_url,p.redirect_chain FROM crawl_links l JOIN crawled_pages p ON p.audit_run_id=l.audit_run_id AND p.url=l.target_url WHERE l.audit_run_id=$1 AND l.is_internal AND (p.status_code BETWEEN 300 AND 399 OR p.redirect_chain <> '[]'::jsonb) ORDER BY l.source_url LIMIT 500").bind(input.audit_id).fetch_all(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    let targets: Vec<(String, String)> = if input.check_external.unwrap_or(false) {
        sqlx::query_as("SELECT source_url,target_url FROM crawl_links WHERE audit_run_id=$1 AND NOT is_internal LIMIT 25").bind(input.audit_id).fetch_all(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?
    } else {
        Vec::new()
    };
    let external_checked = targets.len();
    let mut external_failures = Vec::new();
    let engine = CrawlEngine::with_cache(
        state.pool.clone(),
        state.config.crawl_response_byte_limit,
        state.config.crawl_request_timeout_secs,
        state.config.crawl_max_redirects,
        state.config.crawl_cache_ttl_secs,
    );
    for (source_url, target_url) in targets {
        match engine.fetch_html(&target_url).await {
            Ok(page) if page.status.is_success() => {}
            Ok(page) => external_failures.push(LinkTargetIssue {
                source_url,
                target_url,
                status_code: Some(page.status.as_u16() as i32),
                final_url: Some(page.final_url),
                redirect_chain: Some(serde_json::json!(page.redirect_chain)),
            }),
            Err(_) => external_failures.push(LinkTargetIssue {
                source_url,
                target_url,
                status_code: None,
                final_url: None,
                redirect_chain: None,
            }),
        }
    }
    Ok(Json(BrokenLinksResponse {
        broken_internal,
        redirecting_internal,
        external_checked,
        external_failures,
        limitation: "External targets are sampled and may change after the audit. A redirect is reported as a maintenance signal, not automatically as an error.",
    }))
}

#[derive(Deserialize, Serialize)]
struct DuplicateContentRequest {
    audit_id: Uuid,
}
#[derive(Serialize)]
struct DuplicateContentResponse {
    exact_title_groups: Vec<DuplicateGroup>,
    exact_description_groups: Vec<DuplicateGroup>,
    similar_metadata_groups: Vec<DuplicateGroup>,
    near_duplicate_content: Vec<DuplicateGroup>,
    limitation: &'static str,
}
#[derive(Serialize)]
struct DuplicateGroup {
    fingerprint: String,
    urls: Vec<String>,
    similarity_basis: &'static str,
}
#[derive(FromRow)]
struct DuplicatePage {
    url: String,
    title: Option<String>,
    meta_description: Option<String>,
    headings: serde_json::Value,
}
async fn duplicate_content_analyze(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<DuplicateContentRequest>,
) -> Result<Json<DuplicateContentResponse>, ApiError> {
    authorize_audit_capability(&state, input.audit_id, &headers).await?;
    let pages:Vec<DuplicatePage>=sqlx::query_as("SELECT url,title,meta_description,headings FROM crawled_pages WHERE audit_run_id=$1 ORDER BY url").bind(input.audit_id).fetch_all(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    let bodies: Vec<(String, String)> = sqlx::query_as("SELECT p.url,e.main_text FROM crawled_pages p JOIN page_extractions e ON e.crawled_page_id=p.id WHERE p.audit_run_id=$1 AND length(e.main_text)>0 ORDER BY p.url LIMIT 300")
        .bind(input.audit_id).fetch_all(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    let mut titles = std::collections::BTreeMap::<String, Vec<String>>::new();
    let mut descriptions = std::collections::BTreeMap::<String, Vec<String>>::new();
    let mut metadata = std::collections::BTreeMap::<String, Vec<String>>::new();
    for page in pages {
        let title = page.title.unwrap_or_default();
        let description = page.meta_description.unwrap_or_default();
        let key = normalize_fingerprint(&title);
        if !key.is_empty() {
            titles.entry(key).or_default().push(page.url.clone());
        }
        let key = normalize_fingerprint(&description);
        if !key.is_empty() {
            descriptions.entry(key).or_default().push(page.url.clone());
        }
        let key = normalize_fingerprint(&format!("{} {}", title, page.headings));
        if !key.is_empty() {
            metadata.entry(key).or_default().push(page.url);
        }
    }
    let groups = |source: std::collections::BTreeMap<String, Vec<String>>, basis: &'static str| {
        source
            .into_iter()
            .filter(|(_, urls)| urls.len() > 1)
            .map(|(fingerprint, urls)| DuplicateGroup {
                fingerprint,
                urls,
                similarity_basis: basis,
            })
            .collect()
    };
    let token_sets: Vec<(String, std::collections::HashSet<String>)> = bodies
        .into_iter()
        .map(|(url, text)| {
            let tokens = crate::geo_audit::duplicate::normalized_tokens(&text);
            (url, tokens)
        })
        .collect();
    let mut near_duplicate_content = Vec::new();
    for left in 0..token_sets.len() {
        for right in (left + 1)..token_sets.len() {
            let left_set = &token_sets[left].1;
            let right_set = &token_sets[right].1;
            if let Some(similarity) =
                crate::geo_audit::duplicate::jaccard_similarity(left_set, right_set)
                    .filter(|score| *score >= 0.85)
            {
                near_duplicate_content.push(DuplicateGroup {
                    fingerprint: format!("jaccard:{similarity:.3}"),
                    urls: vec![token_sets[left].0.clone(), token_sets[right].0.clone()],
                    similarity_basis: "normalized body-token Jaccard similarity (heuristic)",
                });
            }
        }
    }
    Ok(Json(DuplicateContentResponse {
        exact_title_groups: groups(titles, "normalized exact title"),
        exact_description_groups: groups(descriptions, "normalized exact description"),
        similar_metadata_groups: groups(metadata, "normalized title and heading metadata"),
        near_duplicate_content,
        limitation: "Near duplicates compare normalized unique body tokens using Jaccard similarity and are heuristic. Pages under 30 unique tokens and pages beyond the 300 page comparison cap are not compared.",
    }))
}
fn normalize_fingerprint(value: &str) -> String {
    value
        .split_whitespace()
        .map(|word| {
            word.trim_matches(|c: char| !c.is_alphanumeric())
                .to_ascii_lowercase()
        })
        .filter(|word| !word.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}
fn collect_schema_names(value: &serde_json::Value, names: &mut Vec<String>) {
    match value {
        serde_json::Value::Array(values) => {
            for value in values {
                collect_schema_names(value, names);
            }
        }
        serde_json::Value::Object(object) => {
            let kind = object
                .get("@type")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            let kind = kind
                .rsplit(|ch| matches!(ch, '/' | '#' | ':'))
                .next()
                .unwrap_or(kind);
            if matches!(kind, "Organization" | "LocalBusiness") {
                if let Some(name) = object
                    .get("name")
                    .and_then(serde_json::Value::as_str)
                    .or_else(|| {
                        object
                            .get("properties")
                            .and_then(|props| props.get("name"))
                            .and_then(serde_json::Value::as_str)
                    })
                {
                    names.push(name.into());
                }
            }
            if let Some(value) = object.get("value") {
                collect_schema_names(value, names);
            }
            if let Some(properties) = object.get("properties") {
                collect_schema_names(properties, names);
            }
            if let Some(graph) = object.get("@graph") {
                collect_schema_names(graph, names);
            }
        }
        _ => {}
    }
}
#[derive(Deserialize, Serialize)]
struct SchemaValidateRequest {
    json_ld: Option<String>,
    url: Option<String>,
    audit_id: Option<Uuid>,
}
async fn schema_validate(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<SchemaValidateRequest>,
) -> Result<Json<Vec<crate::geo_audit::schema::SchemaAnalysis>>, ApiError> {
    if let Some(audit_id) = input.audit_id {
        authorize_audit_capability(&state, audit_id, &headers).await?;
    }
    match (input.json_ld, input.url) {
        (Some(value), _) => {
            return Ok(Json(vec![crate::geo_audit::schema::analyze_json_ld(
                &value,
            )]));
        }
        (None, Some(url)) => {
            let target = CanonicalUrl::parse(&url).map_err(ApiError::Validation)?;
            let page = CrawlEngine::with_cache(
                state.pool.clone(),
                state.config.crawl_response_byte_limit,
                state.config.crawl_request_timeout_secs,
                state.config.crawl_max_redirects,
                state.config.crawl_cache_ttl_secs,
            )
            .fetch_html(target.as_str())
            .await
            .map_err(ApiError::Internal)?;
            return Ok(Json(crate::geo_audit::schema::analyze_document(&page.body)));
        }
        (None, None) if input.audit_id.is_some() => {
            let rows: Vec<serde_json::Value> = sqlx::query_scalar("SELECT structured_data FROM crawled_pages WHERE audit_run_id=$1 AND status_code BETWEEN 200 AND 299 ORDER BY url")
                .bind(input.audit_id.unwrap()).fetch_all(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
            if rows.is_empty() {
                return Err(ApiError::NotFound);
            }
            let mut analyses = Vec::new();
            for row in rows {
                if let Some(entries) = row.as_array() {
                    for entry in entries {
                        if let Some(value) = entry.get("value") {
                            analyses.push(crate::geo_audit::schema::analyze_json_ld(
                                &value.to_string(),
                            ));
                        } else if entry.get("valid_json").and_then(serde_json::Value::as_bool)
                            == Some(false)
                        {
                            analyses.push(crate::geo_audit::schema::analyze_json_ld("{"));
                        } else if let Some(source) =
                            entry.get("source").and_then(serde_json::Value::as_str)
                        {
                            analyses.push(crate::geo_audit::schema::analyze_property_entities(
                                vec![entry.clone()],
                                source,
                            ));
                        }
                    }
                }
            }
            if analyses.is_empty() {
                return Ok(Json(crate::geo_audit::schema::analyze_document(
                    "<html></html>",
                )));
            }
            return Ok(Json(analyses));
        }
        (None, None) => {
            return Err(ApiError::Validation(
                "Provide either json_ld or URL.".into(),
            ));
        }
    }
}
#[derive(Deserialize, Serialize)]
struct PromptIdeasRequest {
    industry: String,
    brand_name: Option<String>,
    products_services: Option<Vec<String>>,
    location: Option<String>,
    audience: Option<String>,
    project_id: Option<Uuid>,
    audit_id: Option<Uuid>,
}
async fn prompt_ideas(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<PromptIdeasRequest>,
) -> Result<Json<crate::geo_audit::prompts::PromptIdeas>, ApiError> {
    if input.industry.trim().is_empty() {
        return Err(ApiError::Validation("Industry is required.".into()));
    }
    if input.project_id.is_some() && input.audit_id.is_none() {
        return Err(ApiError::Unauthorized);
    }
    if let Some(audit_id) = input.audit_id {
        authorize_audit_capability(&state, audit_id, &headers).await?;
    }
    if let Some(project_id) = input.project_id {
        let project_exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM projects WHERE id=$1)")
                .bind(project_id)
                .fetch_one(&state.pool)
                .await
                .map_err(|error| ApiError::Internal(error.into()))?;
        if !project_exists {
            return Err(ApiError::NotFound);
        }
    }
    if let Some(audit_id) = input.audit_id {
        let audit_project: Option<Option<Uuid>> =
            sqlx::query_scalar("SELECT project_id FROM audit_runs WHERE id=$1")
                .bind(audit_id)
                .fetch_optional(&state.pool)
                .await
                .map_err(|error| ApiError::Internal(error.into()))?;
        let project_id_for_audit = audit_project.ok_or(ApiError::NotFound)?;
        if input.project_id.is_some() && input.project_id != project_id_for_audit {
            return Err(ApiError::Validation(
                "audit_id does not belong to project_id.".into(),
            ));
        }
    }
    let ideas = crate::geo_audit::prompts::generate(
        &input.industry,
        input.brand_name.as_deref(),
        &input.products_services.unwrap_or_default(),
        input.location.as_deref(),
        input.audience.as_deref(),
    );
    for idea in &ideas.suggestions {
        sqlx::query("INSERT INTO prompt_ideas(project_id,audit_run_id,prompt,category) VALUES($1,$2,$3,$4) ON CONFLICT(project_id,prompt) DO NOTHING")
            .bind(input.project_id).bind(input.audit_id).bind(&idea.prompt).bind(idea.category).execute(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    }
    Ok(Json(ideas))
}

#[derive(Deserialize, Serialize)]
struct OpportunitiesRequest {
    audit_id: Uuid,
}
#[derive(Serialize)]
struct OpportunityItem {
    finding_code: String,
    priority: i32,
    severity: String,
    title: String,
    evidence: serde_json::Value,
    recommendation: String,
    effort: &'static str,
}
#[derive(Serialize)]
struct OpportunitiesResponse {
    audit_id: Uuid,
    opportunities: Vec<OpportunityItem>,
    limitation: &'static str,
}
async fn opportunities_analyze(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<OpportunitiesRequest>,
) -> Result<Json<OpportunitiesResponse>, ApiError> {
    authorize_audit_capability(&state, input.audit_id, &headers).await?;
    let findings:Vec<(Uuid,String,String,String,serde_json::Value,String)>=sqlx::query_as("SELECT id,severity,code,title,evidence,recommendation FROM audit_findings WHERE audit_run_id=$1 ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END").bind(input.audit_id).fetch_all(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    let mut opportunities = Vec::new();
    for (index, (finding_id, severity, code, title, evidence, recommendation)) in
        findings.into_iter().enumerate()
    {
        let base: i32 = match severity.as_str() {
            "critical" => 100,
            "high" => 85,
            "medium" => 65,
            _ => 40,
        };
        let priority = base.saturating_sub((index as i32).min(20));
        let effort = if code.contains("metadata") || code.contains("heading") {
            "low"
        } else if code.contains("schema") || code.contains("link") {
            "medium"
        } else {
            "variable"
        };
        sqlx::query("INSERT INTO opportunities(audit_run_id,source_finding_id,priority,title,evidence,recommendation) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(audit_run_id,source_finding_id) WHERE source_finding_id IS NOT NULL DO UPDATE SET priority=EXCLUDED.priority,title=EXCLUDED.title,evidence=EXCLUDED.evidence,recommendation=EXCLUDED.recommendation")
            .bind(input.audit_id).bind(finding_id).bind(priority).bind(&title).bind(&evidence).bind(&recommendation).execute(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
        opportunities.push(OpportunityItem {
            finding_code: code,
            priority,
            severity,
            title,
            evidence,
            recommendation,
            effort,
        });
    }
    Ok(Json(OpportunitiesResponse {
        audit_id: input.audit_id,
        opportunities,
        limitation: "Priorities are rule-based estimates from this audit's evidence; they do not predict traffic or AI citations.",
    }))
}

#[derive(Deserialize, Serialize)]
struct ReportDataRequest {
    audit_id: Uuid,
}

/// Tool 15: normalized, evidence-backed report payload built only from persisted audit rows.
async fn report_data_builder(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<ReportDataRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    authorize_audit_capability(&state, input.audit_id, &headers).await?;
    let audit: Option<serde_json::Value> =
        sqlx::query_scalar("SELECT to_jsonb(a) FROM audit_runs a WHERE id=$1")
            .bind(input.audit_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|error| ApiError::Internal(error.into()))?;
    let audit = audit.ok_or(ApiError::NotFound)?;
    let score: Option<serde_json::Value> =
        sqlx::query_scalar("SELECT to_jsonb(s) FROM audit_scores s WHERE audit_run_id=$1")
            .bind(input.audit_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|error| ApiError::Internal(error.into()))?;
    let crawl: Option<serde_json::Value> =
        sqlx::query_scalar("SELECT to_jsonb(c) FROM crawl_runs c WHERE audit_run_id=$1")
            .bind(input.audit_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|error| ApiError::Internal(error.into()))?;
    let findings: serde_json::Value = sqlx::query_scalar("SELECT COALESCE(jsonb_agg(jsonb_build_object('analyzer_id',analyzer_id,'analyzer_version',analyzer_version,'code',code,'severity',severity,'affected_url',affected_url,'evidence',evidence,'explanation',title,'recommended_action',recommendation,'evaluation_status',evaluation_status,'documentation_reference',documentation_reference) ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,created_at),'[]'::jsonb) FROM audit_findings WHERE audit_run_id=$1")
        .bind(input.audit_id).fetch_one(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    let pages: serde_json::Value = sqlx::query_scalar("SELECT COALESCE(jsonb_agg(jsonb_build_object('url',p.url,'final_url',p.final_url,'canonical_url',p.canonical_url,'status_code',p.status_code,'title',p.title,'description',p.meta_description,'robots',p.meta_robots,'x_robots_tag',p.x_robots_tag,'headings',p.headings,'links',p.links,'structured_data',p.structured_data,'depth',p.depth,'word_count',p.word_count,'content_hash',p.content_hash,'redirect_chain',p.redirect_chain,'extraction',e.extraction) ORDER BY p.url),'[]'::jsonb) FROM crawled_pages p LEFT JOIN page_extractions e ON e.crawled_page_id=p.id WHERE p.audit_run_id=$1")
        .bind(input.audit_id).fetch_one(&state.pool).await.map_err(|error|ApiError::Internal(error.into()))?;
    Ok(Json(serde_json::json!({
        "schema_version":"answerscope.geo-report.v1",
        "audit":audit,
        "crawl":crawl,
        "readiness_score":score,
        "findings":findings,
        "pages":pages,
        "limitations":["GEO Readiness is derived from saved website audit evidence and is not measured AI visibility.","Coverage is limited to pages fetched within the saved crawl scope and robots policy."]
    })))
}

async fn integration_availability(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<crate::integrations::google::IntegrationAvailability>> {
    Json(crate::integrations::google::availability(
        &crate::integrations::google::GoogleOAuthConfig {
            client_id: state.config.google_oauth_client_id.clone(),
            client_secret: state.config.google_oauth_client_secret.clone(),
            redirect_base_url: "/api/v1/integrations/google/callback".into(),
        },
    ))
}

analysis_run_wrapper!(
    ai_crawler_run,
    ai_crawler_check,
    AiCrawlerCheckRequest,
    "ai_crawler_accessibility"
);
analysis_run_wrapper!(
    robots_run,
    robots_analyze,
    WebsiteToolRequest,
    "robots_analyzer"
);
analysis_run_wrapper!(
    sitemap_run,
    sitemap_analyze,
    SitemapAnalyzeRequest,
    "sitemap_analyzer"
);
analysis_run_wrapper!(
    schema_run,
    schema_validate,
    SchemaValidateRequest,
    "structured_data_validator"
);
analysis_run_wrapper!(meta_run, meta_analyze, WebsiteToolRequest, "meta_analyzer");
analysis_run_wrapper!(
    content_run,
    content_analyze,
    ContentAnalyzeRequest,
    "content_geo_readiness"
);
analysis_run_wrapper!(
    brand_run,
    brand_analyze,
    BrandAnalyzeRequest,
    "brand_entity_consistency"
);
analysis_run_wrapper!(
    internal_links_run,
    internal_links_analyze,
    InternalLinksRequest,
    "internal_link_analyzer"
);
analysis_run_wrapper!(
    performance_run,
    performance_analyze,
    PerformanceRequest,
    "pagespeed_performance"
);
analysis_run_wrapper!(
    broken_links_run,
    broken_links_analyze,
    BrokenLinksRequest,
    "broken_links_redirects"
);
analysis_run_wrapper!(
    duplicate_content_run,
    duplicate_content_analyze,
    DuplicateContentRequest,
    "duplicate_content"
);
analysis_run_wrapper!(
    prompt_ideas_run,
    prompt_ideas,
    PromptIdeasRequest,
    "deterministic_prompt_ideas"
);
analysis_run_wrapper!(
    opportunities_run,
    opportunities_analyze,
    OpportunitiesRequest,
    "geo_opportunity_finder"
);
analysis_run_wrapper!(
    report_data_run,
    report_data_builder,
    ReportDataRequest,
    "geo_report_data_builder"
);

#[cfg(test)]
mod analysis_contract_tests {
    use super::normalize_tool_output;
    use serde_json::json;

    #[test]
    fn normalizes_analyzer_finding_contract() {
        let output = normalize_tool_output(
            "meta_test",
            json!({"findings":[{"code":"metadata.missing_title","severity":"medium","title":"Title missing","evidence":{"url":"https://example.test/"},"recommendation":"Add a page title."}]}),
        );
        let finding = &output["findings"][0];
        assert_eq!(finding["analyzer_id"], "meta_test");
        assert_eq!(finding["analyzer_version"], "1.1.0");
        assert_eq!(finding["finding_code"], "metadata.missing_title");
        assert_eq!(finding["affected_url"], "https://example.test/");
        assert_eq!(finding["evaluation_status"], "evaluated");
        assert_eq!(finding["recommended_action"], "Add a page title.");
    }
}

// ============================================================================
// Technical GEO Audit API handlers
// ============================================================================

#[derive(Deserialize)]
pub struct ListAuditsQuery {
    pub project_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Serialize)]
pub struct AuditListItem {
    pub id: Uuid,
    pub project_id: Option<Uuid>,
    pub requested_url: String,
    pub canonical_url: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

async fn list_audits(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<ListAuditsQuery>,
) -> Result<Json<Vec<AuditListItem>>, ApiError> {
    // Verify project access if project_id is specified
    if let Some(pid) = q.project_id {
        crate::auth::authorize_project(&state.pool, &headers, pid, false).await?;
    }
    let mut sql = "SELECT id, project_id, requested_url, canonical_url, status::text, created_at, completed_at FROM audit_runs".to_string();
    let mut param_count = 0;
    if q.project_id.is_some() {
        param_count += 1;
        sql.push_str(&format!(" WHERE project_id = ${param_count}"));
    }
    sql.push_str(" ORDER BY created_at DESC");
    if let Some(limit) = q.limit {
        param_count += 1;
        sql.push_str(&format!(" LIMIT ${param_count}"));
    }
    if let Some(offset) = q.offset {
        param_count += 1;
        sql.push_str(&format!(" OFFSET ${param_count}"));
    }

    let mut query = sqlx::query(&sql);
    if let Some(pid) = q.project_id {
        query = query.bind(pid);
    }
    if let Some(limit) = q.limit {
        query = query.bind(limit as i64);
    }
    if let Some(offset) = q.offset {
        query = query.bind(offset as i64);
    }

    let rows = query.fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let audits: Vec<AuditListItem> = rows.into_iter().map(|r| {
        use sqlx::Row;
        AuditListItem {
            id: r.get::<Uuid, _>("id"),
            project_id: r.get::<Option<Uuid>, _>("project_id"),
            requested_url: r.get::<String, _>("requested_url"),
            canonical_url: r.get::<String, _>("canonical_url"),
            status: r.get::<String, _>("status"),
            created_at: r.get::<DateTime<Utc>, _>("created_at"),
            completed_at: r.get::<Option<DateTime<Utc>>, _>("completed_at"),
        }
    }).collect();
    Ok(Json(audits))
}

async fn get_audit_progress(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(audit_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    authorize_audit_capability(&state, audit_id, &headers).await?;
    let audit: AuditRun = sqlx::query_as("SELECT id, requested_url, canonical_url, status::text AS status, created_at, completed_at, failure_reason FROM audit_runs WHERE id=$1")
        .bind(audit_id).fetch_optional(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?
        .ok_or(ApiError::NotFound)?;
    let crawl_row = sqlx::query("SELECT pages_attempted, pages_fetched, excluded_by_robots, coverage_notes FROM crawl_runs WHERE audit_run_id=$1")
        .bind(audit_id).fetch_optional(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let (pages_attempted, pages_fetched, excluded_by_robots, coverage_notes) = match &crawl_row {
        Some(r) => (
            r.get::<Option<i32>, _>("pages_attempted").unwrap_or(0) as i64,
            r.get::<Option<i32>, _>("pages_fetched").unwrap_or(0) as i64,
            r.get::<Option<i32>, _>("excluded_by_robots").unwrap_or(0) as i64,
            r.get::<Option<serde_json::Value>, _>("coverage_notes").unwrap_or(serde_json::json!([])),
        ),
        None => (0, 0, 0, serde_json::json!([])),
    };
    Ok(Json(serde_json::json!({
        "audit_id": audit.id,
        "status": audit.status,
        "pages_attempted": pages_attempted,
        "pages_fetched": pages_fetched,
        "excluded_by_robots": excluded_by_robots,
        "coverage_notes": coverage_notes,
        "created_at": audit.created_at,
        "completed_at": audit.completed_at,
        "failure_reason": audit.failure_reason,
    })))
}

async fn get_audit_summary(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(audit_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    authorize_audit_capability(&state, audit_id, &headers).await?;
    let score_row = sqlx::query("SELECT overall_score, technical_score, metadata_score, structure_score, schema_score, links_score, confidence, limitations FROM audit_scores WHERE audit_run_id=$1")
        .bind(audit_id).fetch_optional(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let score = score_row.map(|r| {
        use sqlx::Row;
        serde_json::json!({
            "overall_score": r.get::<Option<i16>, _>("overall_score"),
            "technical_score": r.get::<Option<i16>, _>("technical_score"),
            "metadata_score": r.get::<Option<i16>, _>("metadata_score"),
            "structure_score": r.get::<Option<i16>, _>("structure_score"),
            "schema_score": r.get::<Option<i16>, _>("schema_score"),
            "links_score": r.get::<Option<i16>, _>("links_score"),
            "confidence": r.get::<Option<i16>, _>("confidence"),
            "limitations": r.get::<Option<serde_json::Value>, _>("limitations").unwrap_or(serde_json::json!([])),
        })
    });
    let finding_counts: serde_json::Value = sqlx::query_scalar("SELECT COALESCE(jsonb_object_agg(severity, total), '{}'::jsonb) FROM (SELECT severity, count(*)::int AS total FROM audit_findings WHERE audit_run_id=$1 GROUP BY severity) counts")
        .bind(audit_id).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(serde_json::json!({
        "audit_id": audit_id,
        "score": score,
        "finding_counts": finding_counts,
    })))
}

async fn get_audit_scores(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(audit_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    authorize_audit_capability(&state, audit_id, &headers).await?;
    let rows = sqlx::query("SELECT category, score, weight, rules_passed, rules_failed, rules_unavailable, coverage FROM audit_score_categories WHERE audit_run_id=$1 ORDER BY category")
        .bind(audit_id).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let categories: Vec<serde_json::Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        serde_json::json!({
            "category": r.get::<String, _>("category"),
            "score": r.get::<i16, _>("score"),
            "weight": r.get::<f64, _>("weight"),
            "rules_passed": r.get::<i32, _>("rules_passed"),
            "rules_failed": r.get::<i32, _>("rules_failed"),
            "rules_unavailable": r.get::<i32, _>("rules_unavailable"),
            "coverage": r.get::<f64, _>("coverage"),
        })
    }).collect();
    Ok(Json(serde_json::json!({"audit_id": audit_id, "categories": categories})))
}

async fn get_audit_opportunities(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(audit_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    authorize_audit_capability(&state, audit_id, &headers).await?;
    let rows = sqlx::query("SELECT id, title, explanation, category, severity, priority, estimated_effort, confidence, status, affected_urls, suggested_fix, created_at FROM audit_opportunities WHERE audit_run_id=$1 ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at")
        .bind(audit_id).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let opportunities: Vec<serde_json::Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        serde_json::json!({
            "id": r.get::<Uuid, _>("id"),
            "title": r.get::<String, _>("title"),
            "explanation": r.get::<String, _>("explanation"),
            "category": r.get::<String, _>("category"),
            "severity": r.get::<String, _>("severity"),
            "priority": r.get::<String, _>("priority"),
            "estimated_effort": r.get::<String, _>("estimated_effort"),
            "confidence": r.get::<f64, _>("confidence"),
            "status": r.get::<String, _>("status"),
            "affected_urls": r.get::<Option<serde_json::Value>, _>("affected_urls").unwrap_or(serde_json::json!([])),
            "suggested_fix": r.get::<Option<String>, _>("suggested_fix"),
            "created_at": r.get::<DateTime<Utc>, _>("created_at"),
        })
    }).collect();
    Ok(Json(serde_json::json!({"audit_id": audit_id, "opportunities": opportunities})))
}

// Tool-specific analyzer routes (wrappers around existing analyzers)

#[derive(Deserialize)]
pub struct RobotsAnalyzerRequest {
    pub url: String,
    pub path: Option<String>,
}

async fn robots_analyzer(
    State(state): State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(input): Json<RobotsAnalyzerRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let target = answerscope_web_intelligence::safe_url::CanonicalUrl::parse(&input.url)
        .map_err(ApiError::Validation)?;
    let parsed = url::Url::parse(target.as_str()).map_err(|e| ApiError::Internal(e.into()))?;
    let robots_url = format!("{}/robots.txt", parsed.origin().ascii_serialization());
    let engine = crate::crawler::worker::CrawlEngine::with_cache(
        state.pool.clone(),
        state.config.crawl_response_byte_limit,
        state.config.crawl_request_timeout_secs,
        state.config.crawl_max_redirects,
        state.config.crawl_cache_ttl_secs,
    );
    let page = engine.fetch_html(&robots_url).await.map_err(|e| ApiError::Internal(e.into()))?;
    let document = answerscope_web_intelligence::robots::RobotsDocument::parse(&page.body);
    let path = input.path.as_deref().unwrap_or(parsed.path());
    let evaluation = document.evaluate("AnswerScopeBot", path);
    Ok(Json(serde_json::json!({
        "evaluated_url": target.into_string(),
        "robots_url": page.final_url,
        "http_status": page.status.as_u16(),
        "document": document,
        "requested_path": path,
        "evaluation": evaluation,
    })))
}

#[derive(Deserialize)]
pub struct SitemapAnalyzerRequest {
    pub url: String,
    pub sitemap_url: Option<String>,
}

async fn sitemap_analyzer_tool(
    State(state): State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(input): Json<SitemapAnalyzerRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let site = answerscope_web_intelligence::safe_url::CanonicalUrl::parse(&input.url)
        .map_err(ApiError::Validation)?;
    let site_url = url::Url::parse(site.as_str()).map_err(|e| ApiError::Internal(e.into()))?;
    let root = match input.sitemap_url {
        Some(v) => answerscope_web_intelligence::safe_url::CanonicalUrl::parse(&v)
            .map_err(ApiError::Validation)?
            .into_string(),
        None => format!("{}/sitemap.xml", site_url.origin().ascii_serialization()),
    };
    let engine = crate::crawler::worker::CrawlEngine::with_cache(
        state.pool.clone(),
        state.config.crawl_response_byte_limit,
        state.config.crawl_request_timeout_secs,
        state.config.crawl_max_redirects,
        state.config.crawl_cache_ttl_secs,
    );
    let page = engine.fetch_html(&root).await.map_err(|e| ApiError::Internal(e.into()))?;
    let document = answerscope_web_intelligence::sitemap::parse(&page.body);
    Ok(Json(serde_json::json!({
        "root_sitemap_url": root,
        "kind": format!("{:?}", document.kind),
        "url_entries": document.entries.len(),
        "entries": document.entries,
        "warnings": document.parse_warnings,
    })))
}

#[derive(Deserialize)]
pub struct SchemaValidatorRequest {
    pub url: Option<String>,
    pub json_ld: Option<String>,
    pub audit_id: Option<Uuid>,
}

async fn schema_validator(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<SchemaValidatorRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if let Some(audit_id) = input.audit_id {
        authorize_audit_capability(&state, audit_id, &headers).await?;
    }
    if let Some(json_ld) = input.json_ld {
        let analysis = answerscope_geo_audit::schema::analyze_json_ld(&json_ld);
        return Ok(Json(serde_json::json!({
            "documents": analysis.documents,
            "types": analysis.types,
            "findings": analysis.findings,
        })));
    }
    if let Some(url) = input.url {
        let target = answerscope_web_intelligence::safe_url::CanonicalUrl::parse(&url)
            .map_err(ApiError::Validation)?;
        let engine = crate::crawler::worker::CrawlEngine::with_cache(
            state.pool.clone(),
            state.config.crawl_response_byte_limit,
            state.config.crawl_request_timeout_secs,
            state.config.crawl_max_redirects,
            state.config.crawl_cache_ttl_secs,
        );
        let page = engine.fetch_html(target.as_str()).await.map_err(|e| ApiError::Internal(e.into()))?;
        let document = scraper::Html::parse_document(&page.body);
        let analyses = answerscope_geo_audit::schema::analyze_document(&page.body);
        Ok(Json(serde_json::json!({
            "url": target.into_string(),
            "analyses": analyses,
        })))
    } else {
        Err(ApiError::Validation("Provide url, json_ld, or audit_id".into()))
    }
}

#[derive(Deserialize)]
pub struct MetaAnalyzerRequest {
    pub url: String,
}

async fn meta_analyzer_tool(
    State(state): State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(input): Json<MetaAnalyzerRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let target = answerscope_web_intelligence::safe_url::CanonicalUrl::parse(&input.url)
        .map_err(ApiError::Validation)?;
    let engine = crate::crawler::worker::CrawlEngine::with_cache(
        state.pool.clone(),
        state.config.crawl_response_byte_limit,
        state.config.crawl_request_timeout_secs,
        state.config.crawl_max_redirects,
        state.config.crawl_cache_ttl_secs,
    );
    let page = engine.fetch_html(target.as_str()).await.map_err(|e| ApiError::Internal(e.into()))?;
    let document = scraper::Html::parse_document(&page.body);
    let title = document.select(&scraper::Selector::parse("title").unwrap())
        .next().map(|n| n.text().collect::<Vec<_>>().join(" ").trim().to_owned());
    let description = select_attr(&document, "meta[name='description']", "content");
    let robots = select_attr(&document, "meta[name='robots']", "content");
    let canonical = select_attr(&document, "link[rel='canonical']", "href");
    Ok(Json(serde_json::json!({
        "url": page.final_url,
        "title": title,
        "description": description,
        "robots": robots,
        "canonical": canonical,
        "status_code": page.status.as_u16(),
        "x_robots_tag": page.x_robots_tag,
    })))
}

#[derive(Deserialize)]
pub struct InternalLinksToolRequest {
    pub url: String,
}

async fn internal_links_tool(
    State(state): State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(input): Json<InternalLinksToolRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let target = answerscope_web_intelligence::safe_url::CanonicalUrl::parse(&input.url)
        .map_err(ApiError::Validation)?;
    let engine = crate::crawler::worker::CrawlEngine::with_cache(
        state.pool.clone(),
        state.config.crawl_response_byte_limit,
        state.config.crawl_request_timeout_secs,
        state.config.crawl_max_redirects,
        state.config.crawl_cache_ttl_secs,
    );
    let page = engine.fetch_html(target.as_str()).await.map_err(|e| ApiError::Internal(e.into()))?;
    let document = scraper::Html::parse_document(&page.body);
    let base = url::Url::parse(&page.final_url).unwrap_or_else(|_| url::Url::parse("https://example.com/").unwrap());
    let base_host = base.host_str().unwrap_or("");
    let mut internal = Vec::new();
    let mut external = Vec::new();
    for element in document.select(&scraper::Selector::parse("a[href]").unwrap()) {
        if let Some(href) = element.value().attr("href") {
            if let Ok(parsed) = base.join(href) {
                let mut p = parsed;
                p.set_fragment(None);
                let host = p.host_str().unwrap_or("");
                let anchor = element.text().collect::<Vec<_>>().join(" ").trim().to_owned();
                if host.eq_ignore_ascii_case(base_host) {
                    internal.push(serde_json::json!({"url": p.to_string(), "anchor_text": anchor}));
                } else {
                    external.push(serde_json::json!({"url": p.to_string(), "anchor_text": anchor}));
                }
            }
        }
    }
    Ok(Json(serde_json::json!({
        "url": page.final_url,
        "internal_links": internal,
        "external_links": external,
        "internal_count": internal.len(),
        "external_count": external.len(),
    })))
}

#[derive(Deserialize)]
pub struct IndexabilityCheckRequest {
    pub url: String,
}

async fn indexability_check(
    State(state): State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(input): Json<IndexabilityCheckRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let target = answerscope_web_intelligence::safe_url::CanonicalUrl::parse(&input.url)
        .map_err(ApiError::Validation)?;
    let engine = crate::crawler::worker::CrawlEngine::with_cache(
        state.pool.clone(),
        state.config.crawl_response_byte_limit,
        state.config.crawl_request_timeout_secs,
        state.config.crawl_max_redirects,
        state.config.crawl_cache_ttl_secs,
    );
    let page = engine.fetch_html(target.as_str()).await.map_err(|e| ApiError::Internal(e.into()))?;
    let document = scraper::Html::parse_document(&page.body);
    let meta_robots = select_attr(&document, "meta[name='robots']", "content");
    let noindex = meta_robots.as_deref().is_some_and(|v| v.split(',').any(|d| d.trim() == "noindex"))
        || page.x_robots_tag.as_deref().is_some_and(|v| v.split(',').any(|d| d.trim() == "noindex"));
    let status = page.status.as_u16();
    let indexable = status >= 200 && status < 300 && !noindex;
    let classification = if noindex {
        "explicitly_noindex"
    } else if status >= 400 {
        "unavailable"
    } else if indexable {
        "potentially_indexable"
    } else {
        "unknown"
    };
    Ok(Json(serde_json::json!({
        "url": page.final_url,
        "status_code": status,
        "meta_robots": meta_robots,
        "x_robots_tag": page.x_robots_tag,
        "noindex": noindex,
        "classification": classification,
        "limitation": "This is a local heuristic, not Google's actual index state.",
    })))
}

/// GET /api/crawler/robots?domain=example.com
async fn crawler_robots(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Authenticate
    let _user_id = crate::auth::session_user(&state.pool, &headers).await?;

    let domain = params.get("domain").ok_or_else(|| ApiError::Validation("domain is required".into()))?;
    let domain = domain.trim().strip_prefix("https://").unwrap_or(domain);
    let domain = domain.strip_prefix("http://").unwrap_or(domain);
    let domain = domain.strip_prefix("www.").unwrap_or(domain);
    let domain = domain.split('/').next().unwrap_or(domain);

    if domain.is_empty() {
        return Err(ApiError::Validation("domain is required".into()));
    }

    let robots_url = format!("https://{}/robots.txt", domain);
    let page = CrawlEngine::with_cache(
        state.pool.clone(),
        state.config.crawl_response_byte_limit,
        state.config.crawl_request_timeout_secs,
        state.config.crawl_max_redirects,
        state.config.crawl_cache_ttl_secs,
    )
    .fetch_html(&robots_url)
    .await
    .map_err(ApiError::Internal)?;

    let document = RobotsDocument::parse(&page.body);
    let found = page.status.is_success();

    let crawlers = [
        ("GPTBot", "OpenAI", "training"),
        ("ChatGPT-User", "OpenAI", "user-initiated retrieval"),
        ("OAI-SearchBot", "OpenAI", "search"),
        ("ClaudeBot", "Anthropic", "training"),
        ("Claude-SearchBot", "Anthropic", "search"),
        ("Google-Extended", "Google", "training control"),
        ("Googlebot", "Google", "web search"),
        ("PerplexityBot", "Perplexity", "search"),
        ("Applebot", "Apple", "web search"),
    ];

    let bots: Vec<serde_json::Value> = crawlers.iter().map(|(bot, owner, purpose)| {
        let eval = document.evaluate(bot, "/");
        let status = if eval.allowed { "allowed" } else { "blocked" };
          serde_json::json!({
              "bot": bot,
              "owner": owner,
              "purpose": purpose,
              "status": status,
              "evaluation": eval,
          })
    }).collect();

    Ok(Json(serde_json::json!({
        "found": found,
        "bots": bots,
    })))
}

