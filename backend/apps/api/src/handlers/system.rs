//! Foundation operational endpoints: liveness, readiness, service metadata and
//! the generated OpenAPI document.

use std::{sync::Arc, time::Duration};

use answerscope_api_contracts::{
    API_VERSION, ApiMeta, HealthData, HealthResponse, ReadinessCheck, ReadinessData,
    ReadinessResponse, SystemInfoData, SystemInfoResponse,
};
use answerscope_observability::RequestId;
use axum::{Json, extract::State, http::StatusCode};
use chrono::{SecondsFormat, Utc};

use crate::state::AppState;

/// Liveness probe. This must never touch PostgreSQL so a process can stay alive
/// while a dependency recovers.
#[utoipa::path(
    get,
    path = "/health",
    tag = "system",
    responses(
        (status = 200, body = HealthResponse, description = "Process is alive")
    )
)]
pub async fn health(
    State(state): State<Arc<AppState>>,
    request_id: RequestId,
) -> Json<HealthResponse> {
    Json(HealthResponse {
        data: HealthData {
            status: "ok".to_owned(),
            service: env!("CARGO_PKG_NAME").to_owned(),
            version: env!("CARGO_PKG_VERSION").to_owned(),
            environment: state.config.environment.to_string(),
            uptime_seconds: state.uptime_seconds(),
        },
        meta: ApiMeta {
            request_id: request_id.as_str().to_owned(),
        },
    })
}

/// Readiness probe backed by a real PostgreSQL round trip.
///
/// A disconnected pool, an exhausted pool, or a query exceeding the readiness
/// deadline all produce HTTP 503 with `status = not_ready`.
#[utoipa::path(
    get,
    path = "/ready",
    tag = "system",
    responses(
        (status = 200, body = ReadinessResponse, description = "All required dependencies are available"),
        (status = 503, body = ReadinessResponse, description = "At least one required dependency is unavailable")
    )
)]
pub async fn ready(
    State(state): State<Arc<AppState>>,
    request_id: RequestId,
) -> (StatusCode, Json<ReadinessResponse>) {
    let timeout = Duration::from_millis(state.config.readiness_timeout_ms);
    let (status, http_status, check) =
        match answerscope_persistence::ping(&state.pool, timeout).await {
            Ok(latency_ms) => (
                "ready",
                StatusCode::OK,
                ReadinessCheck {
                    name: "postgresql".to_owned(),
                    status: "up".to_owned(),
                    latency_ms,
                    error: None,
                },
            ),
            Err(error) => {
                tracing::warn!(
                    dependency = "postgresql",
                    error_code = error.code(),
                    request_id = request_id.as_str(),
                    "readiness check failed"
                );
                (
                    "not_ready",
                    StatusCode::SERVICE_UNAVAILABLE,
                    ReadinessCheck {
                        name: "postgresql".to_owned(),
                        status: "down".to_owned(),
                        latency_ms: 0,
                        error: Some(error.code().to_owned()),
                    },
                )
            }
        };

    (
        http_status,
        Json(ReadinessResponse {
            data: ReadinessData {
                status: status.to_owned(),
                checked_at: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
                checks: vec![check],
            },
            meta: ApiMeta {
                request_id: request_id.as_str().to_owned(),
            },
        }),
    )
}

/// Non-sensitive service metadata for clients and operators.
#[utoipa::path(
    get,
    path = "/api/v1/system/info",
    tag = "system",
    responses(
        (status = 200, body = SystemInfoResponse, description = "Service metadata")
    )
)]
pub async fn system_info(
    State(state): State<Arc<AppState>>,
    request_id: RequestId,
) -> Json<SystemInfoResponse> {
    Json(SystemInfoResponse {
        data: SystemInfoData {
            service: env!("CARGO_PKG_NAME").to_owned(),
            version: env!("CARGO_PKG_VERSION").to_owned(),
            api_version: API_VERSION.to_owned(),
            environment: state.config.environment.to_string(),
            build_profile: if cfg!(debug_assertions) {
                "debug".to_owned()
            } else {
                "release".to_owned()
            },
            started_at: state.started_at.to_rfc3339_opts(SecondsFormat::Secs, true),
            database: "postgresql".to_owned(),
            capabilities: [
                "postgresql",
                "sqlx-migrations",
                "request-correlation",
                "openapi",
                "background-worker",
            ]
            .into_iter()
            .map(str::to_owned)
            .collect(),
            openapi_url: "/api/v1/openapi.json".to_owned(),
        },
        meta: ApiMeta {
            request_id: request_id.as_str().to_owned(),
        },
    })
}

/// Generated OpenAPI 3 document for the versioned API.
#[utoipa::path(
    get,
    path = "/api/v1/openapi.json",
    tag = "system",
    responses(
        (status = 200, description = "OpenAPI 3 document", content_type = "application/json")
    )
)]
pub async fn openapi() -> Json<utoipa::openapi::OpenApi> {
    Json(crate::openapi::document())
}
