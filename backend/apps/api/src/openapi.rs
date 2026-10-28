//! Generated OpenAPI contract for the versioned REST API.

use answerscope_api_contracts::{
    ApiMeta, HealthData, HealthResponse, ReadinessCheck, ReadinessData, ReadinessResponse,
    SystemInfoData, SystemInfoResponse,
};
use answerscope_error::ErrorEnvelope;
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "AnswerScope API",
        version = env!("CARGO_PKG_VERSION"),
        description = "Backend-first GEO and AI visibility API. Engine 01 exposes operational endpoints; domain engines are added incrementally.",
        license(name = "UNLICENSED")
    ),
    paths(
        crate::handlers::system::health,
        crate::handlers::system::ready,
        crate::handlers::system::system_info,
        crate::handlers::system::openapi
    ),
    components(schemas(
        ApiMeta,
        HealthData,
        HealthResponse,
        ReadinessCheck,
        ReadinessData,
        ReadinessResponse,
        SystemInfoData,
        SystemInfoResponse,
        ErrorEnvelope
    ))
)]
pub struct ApiDoc;

/// Build a fresh OpenAPI document.
pub fn document() -> utoipa::openapi::OpenApi {
    ApiDoc::openapi()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn document_contains_foundation_paths_and_schemas() {
        let document = serde_json::to_value(document()).expect("OpenAPI serializes");
        assert_eq!(document["openapi"].as_str().unwrap_or_default().split('.').next(), Some("3"));
        assert!(document["paths"]["/health"]["get"].is_object());
        assert!(document["paths"]["/ready"]["get"].is_object());
        assert!(document["paths"]["/api/v1/system/info"]["get"].is_object());
        assert!(document["paths"]["/api/v1/openapi.json"]["get"].is_object());
        assert!(document["components"]["schemas"]["HealthResponse"].is_object());
        assert!(document["components"]["schemas"]["ErrorEnvelope"].is_object());
    }
}
