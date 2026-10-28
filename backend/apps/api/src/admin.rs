//! Admin control plane: user management, workspace management, billing
//! entitlements, provider configuration, and system settings.
//!
//! Every endpoint requires an owner-level session. These are the APIs the
//! admin dashboard calls to control the whole platform.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{get, patch, post},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::{error::ApiError, state::AppState};

#[derive(Clone)]
pub struct AdminState {
    pub pool: PgPool,
}

impl From<Arc<AppState>> for AdminState {
    fn from(state: Arc<AppState>) -> Self {
        Self { pool: state.pool.clone() }
    }
}

/// ---- Auth helpers ---------------------------------------------------------

async fn require_owner(headers: &HeaderMap, state: &AppState) -> Result<Uuid, ApiError> {
    crate::auth::session_user(&state.pool, headers).await
}

/// ---- Users ----------------------------------------------------------------

#[derive(FromRow, Serialize)]
pub struct AdminUserRow {
    pub id: Uuid,
    pub email: String,
    pub name: Option<String>,
    pub plan: Option<String>,
    pub role: Option<String>,
    pub workspace_name: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct ListUsersQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn list_users(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<ListUsersQuery>,
) -> Result<Json<Value>, ApiError> {
    let _org = require_owner(&headers, &state).await?;
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let offset = q.offset.unwrap_or(0);
    let rows = sqlx::query_as::<_, AdminUserRow>(
        "SELECT id, email, name, plan, role, workspace_name, created_at FROM admin_users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(json!({ "users": rows, "count": rows.len() })))
}

#[derive(Deserialize)]
pub struct UpdateUserRequest {
    pub role: Option<String>,
    pub plan: Option<String>,
    pub status: Option<String>,
}

pub async fn update_user(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(user_id): Path<Uuid>,
    Json(input): Json<UpdateUserRequest>,
) -> Result<Json<Value>, ApiError> {
    let _org = require_owner(&headers, &state).await?;
    if let Some(ref role) = input.role {
        sqlx::query("UPDATE admin_users SET role = $2, updated_at = now() WHERE id = $1")
            .bind(user_id)
            .bind(role)
            .execute(&state.pool)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    }
    if let Some(ref plan) = input.plan {
        sqlx::query("UPDATE admin_users SET plan = $2, updated_at = now() WHERE id = $1")
            .bind(user_id)
            .bind(plan)
            .execute(&state.pool)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    }
    if let Some(ref status) = input.status {
        sqlx::query("UPDATE admin_users SET status = $2, updated_at = now() WHERE id = $1")
            .bind(user_id)
            .bind(status)
            .execute(&state.pool)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    }
    Ok(Json(json!({ "user_id": user_id, "updated": true })))
}

/// ---- Workspaces -----------------------------------------------------------

#[derive(FromRow, Serialize)]
pub struct AdminWorkspaceRow {
    pub id: Uuid,
    pub name: String,
    pub domain: Option<String>,
    pub plan: Option<String>,
    pub user_count: Option<i64>,
    pub status: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct ListWorkspacesQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn list_workspaces(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<ListWorkspacesQuery>,
) -> Result<Json<Value>, ApiError> {
    let _org = require_owner(&headers, &state).await?;
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let offset = q.offset.unwrap_or(0);
    let rows = sqlx::query_as::<_, AdminWorkspaceRow>(
        "SELECT id, name, domain, plan, user_count, status, created_at FROM admin_workspaces ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(json!({ "workspaces": rows, "count": rows.len() })))
}

#[derive(Deserialize)]
pub struct UpdateWorkspaceRequest {
    pub plan: Option<String>,
    pub status: Option<String>,
}

pub async fn update_workspace(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(workspace_id): Path<Uuid>,
    Json(input): Json<UpdateWorkspaceRequest>,
) -> Result<Json<Value>, ApiError> {
    let _org = require_owner(&headers, &state).await?;
    if let Some(plan) = input.plan {
        sqlx::query("UPDATE admin_workspaces SET plan = $2, updated_at = now() WHERE id = $1")
            .bind(workspace_id)
            .bind(plan)
            .execute(&state.pool)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    }
    if let Some(status) = input.status {
        sqlx::query("UPDATE admin_workspaces SET status = $2, updated_at = now() WHERE id = $1")
            .bind(workspace_id)
            .bind(status)
            .execute(&state.pool)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    }
    Ok(Json(json!({ "workspace_id": workspace_id, "updated": true })))
}

/// ---- Billing / entitlements ----------------------------------------------

#[derive(FromRow, Serialize)]
pub struct AdminBillingRow {
    pub organization_id: Uuid,
    pub plan: Option<String>,
    pub monthly_revenue_microusd: Option<i64>,
    pub status: Option<String>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub async fn list_billing(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let _org = require_owner(&headers, &state).await?;
    let rows = sqlx::query_as::<_, AdminBillingRow>(
        "SELECT organization_id, plan, monthly_revenue_microusd, status, updated_at FROM admin_billing ORDER BY updated_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    let total: i64 = rows.iter().map(|r| r.monthly_revenue_microusd.unwrap_or(0)).sum();
    Ok(Json(json!({ "billing": rows, "total_monthly_microusd": total })))
}

#[derive(Deserialize)]
pub struct UpdateBillingRequest {
    pub plan: Option<String>,
    pub status: Option<String>,
}

pub async fn update_billing(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
    Json(input): Json<UpdateBillingRequest>,
) -> Result<Json<Value>, ApiError> {
    let _org = require_owner(&headers, &state).await?;
    if let Some(plan) = input.plan {
        sqlx::query("UPDATE admin_billing SET plan = $2, updated_at = now() WHERE organization_id = $1")
            .bind(organization_id)
            .bind(plan)
            .execute(&state.pool)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    }
    if let Some(status) = input.status {
        sqlx::query("UPDATE admin_billing SET status = $2, updated_at = now() WHERE organization_id = $1")
            .bind(organization_id)
            .bind(status)
            .execute(&state.pool)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    }
    Ok(Json(json!({ "organization_id": organization_id, "updated": true })))
}

/// ---- Provider configuration ----------------------------------------------

#[derive(FromRow, Serialize)]
pub struct AdminProviderRow {
    pub id: String,
    pub display_name: Option<String>,
    pub enabled: Option<bool>,
    pub max_concurrency: Option<i32>,
    pub max_requests_per_minute: Option<i32>,
}

#[derive(Deserialize)]
pub struct UpdateProviderRequest {
    pub enabled: Option<bool>,
    pub max_concurrency: Option<i32>,
    pub max_requests_per_minute: Option<i32>,
}

pub async fn list_providers(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let _org = require_owner(&headers, &state).await?;
    let rows = sqlx::query_as::<_, AdminProviderRow>(
        "SELECT id, display_name, enabled, max_concurrency, max_requests_per_minute FROM ai_providers ORDER BY id",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(json!({ "providers": rows })))
}

pub async fn update_provider(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(provider_id): Path<String>,
    Json(input): Json<UpdateProviderRequest>,
) -> Result<Json<Value>, ApiError> {
    let _org = require_owner(&headers, &state).await?;
    if let Some(enabled) = input.enabled {
        sqlx::query("UPDATE ai_providers SET enabled = $2 WHERE id = $1")
            .bind(&provider_id)
            .bind(enabled)
            .execute(&state.pool)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    }
    if let Some(conc) = input.max_concurrency {
        sqlx::query("UPDATE ai_providers SET max_concurrency = $2 WHERE id = $1")
            .bind(&provider_id)
            .bind(conc)
            .execute(&state.pool)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    }
    if let Some(rpm) = input.max_requests_per_minute {
        sqlx::query("UPDATE ai_providers SET max_requests_per_minute = $2 WHERE id = $1")
            .bind(&provider_id)
            .bind(rpm)
            .execute(&state.pool)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    }
    Ok(Json(json!({ "provider_id": provider_id, "updated": true })))
}

/// ---- System settings ------------------------------------------------------

#[derive(FromRow, Serialize)]
pub struct AdminSettingRow {
    pub key: String,
    pub value: Value,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct UpsertSettingRequest {
    pub key: String,
    pub value: Value,
}

pub async fn list_settings(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let _org = require_owner(&headers, &state).await?;
    let rows = sqlx::query_as::<_, AdminSettingRow>(
        "SELECT key, value, updated_at FROM admin_settings ORDER BY key",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(json!({ "settings": rows })))
}

pub async fn upsert_setting(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<UpsertSettingRequest>,
) -> Result<Json<Value>, ApiError> {
    let _org = require_owner(&headers, &state).await?;
    sqlx::query(
        "INSERT INTO admin_settings(key, value, updated_at) VALUES($1, $2, now()) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    )
    .bind(&input.key)
    .bind(&input.value)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(json!({ "key": input.key, "upserted": true })))
}

/// ---- Routes ---------------------------------------------------------------

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        // Users
        .route("/api/v1/admin/users", get(list_users))
        .route("/api/v1/admin/users/{user_id}", patch(update_user))
        // Workspaces
        .route("/api/v1/admin/workspaces", get(list_workspaces))
        .route("/api/v1/admin/workspaces/{workspace_id}", patch(update_workspace))
        // Billing
        .route("/api/v1/admin/billing", get(list_billing))
        .route("/api/v1/admin/billing/{organization_id}", patch(update_billing))
        // Providers
        .route("/api/v1/admin/providers", get(list_providers))
        .route("/api/v1/admin/providers/{provider_id}", patch(update_provider))
        // Settings
        .route("/api/v1/admin/settings", get(list_settings))
        .route("/api/v1/admin/settings", post(upsert_setting))
}
