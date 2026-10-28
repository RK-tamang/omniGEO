//! Stable request and response contracts shared by the API and future clients.
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

/// Current public REST API version.
pub const API_VERSION: &str = "v1";

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AuditSubmission {
    pub url: String,
    pub project_id: Option<Uuid>,
    pub max_pages: Option<usize>,
    pub include_performance: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AuditJobReference {
    pub audit_id: Uuid,
    pub job_id: Uuid,
    pub canonical_url: String,
    pub access_token: String,
}

/// Metadata attached to every foundation API response.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ApiMeta {
    /// Request correlation ID, also returned in the `x-request-id` header.
    pub request_id: String,
}

/// Successful liveness response. Liveness never depends on PostgreSQL.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthData {
    /// `ok` when the process is serving requests.
    pub status: String,
    pub service: String,
    pub version: String,
    pub environment: String,
    /// Whole seconds since this process started.
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthResponse {
    pub data: HealthData,
    pub meta: ApiMeta,
}

/// Result of one readiness dependency check.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ReadinessCheck {
    pub name: String,
    /// `up` or `down`.
    pub status: String,
    pub latency_ms: u64,
    /// Safe error code when the dependency is down; never contains credentials.
    #[schema(nullable = true)]
    pub error: Option<String>,
}

/// Readiness response. The HTTP status is 503 when any required check is down.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ReadinessData {
    /// `ready` or `not_ready`.
    pub status: String,
    pub checked_at: String,
    pub checks: Vec<ReadinessCheck>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ReadinessResponse {
    pub data: ReadinessData,
    pub meta: ApiMeta,
}

/// Stable service metadata that is safe to expose without authentication.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SystemInfoData {
    pub service: String,
    pub version: String,
    /// Versioned REST API prefix, currently `v1`.
    pub api_version: String,
    pub environment: String,
    /// Cargo build profile, for example `debug` or `release`.
    pub build_profile: String,
    /// RFC 3339 timestamp captured when the process started.
    pub started_at: String,
    pub database: String,
    /// Foundation capabilities that this process actually serves.
    pub capabilities: Vec<String>,
    /// Location of the generated OpenAPI document.
    pub openapi_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SystemInfoResponse {
    pub data: SystemInfoData,
    pub meta: ApiMeta,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn foundation_envelopes_serialize_with_data_and_meta() {
        let response = HealthResponse {
            data: HealthData {
                status: "ok".into(),
                service: "answerscope-api".into(),
                version: "0.1.0".into(),
                environment: "test".into(),
                uptime_seconds: 12,
            },
            meta: ApiMeta {
                request_id: "req-12345678".into(),
            },
        };
        let value = serde_json::to_value(response).unwrap();
        assert_eq!(value["data"]["status"], "ok");
        assert_eq!(value["meta"]["request_id"], "req-12345678");
    }

    #[test]
    fn api_version_is_stable() {
        assert_eq!(API_VERSION, "v1");
    }
}
