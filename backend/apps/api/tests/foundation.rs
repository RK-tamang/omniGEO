//! End-to-end tests for the Engine 01 operational surface.
//!
//! A real PostgreSQL database is used when `TEST_DATABASE_URL` (or
//! `BILLING_TEST_DATABASE_URL`) is set. Tests print a skip notice when the
//! variable is absent so `cargo test` remains usable without a database. CI
//! always provides a disposable PostgreSQL service and therefore runs them.

use std::{sync::Arc, time::Duration};

use answerscope_api::{
    config::Config,
    routes,
    state::AppState,
};
use answerscope_persistence::{DatabaseSettings, connect, connect_lazy, migrate};
use reqwest::{Response, StatusCode, header};
use serde_json::Value;
use tokio::net::TcpListener;

fn test_database_url() -> Option<String> {
    std::env::var("TEST_DATABASE_URL")
        .or_else(|_| std::env::var("BILLING_TEST_DATABASE_URL"))
        .ok()
        .filter(|value| !value.trim().is_empty())
}

fn config(database_url: &str, readiness_timeout_ms: u64) -> Config {
    let readiness_timeout_ms = readiness_timeout_ms.to_string();
    Config::from_vars([
        ("APP_ENV", "test"),
        ("LOG_FORMAT", "json"),
        ("DATABASE_URL", database_url),
        ("DATABASE_MAX_CONNECTIONS", "4"),
        ("DB_CONNECT_TIMEOUT_SECS", "2"),
        ("DB_ACQUIRE_TIMEOUT_SECS", "1"),
        ("READINESS_TIMEOUT_MS", readiness_timeout_ms.as_str()),
        ("SHUTDOWN_TIMEOUT_SECS", "2"),
    ])
    .expect("test configuration must be valid")
}

async fn spawn(state: Arc<AppState>) -> (String, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind test server");
    let address = listener.local_addr().expect("test server address");
    let server = tokio::spawn(async move {
        axum::serve(listener, routes::router(state))
            .await
            .expect("test server");
    });
    (format!("http://{address}"), server)
}

async fn json(response: Response) -> Value {
    response.json().await.expect("JSON response body")
}

fn request_id_header(response: &Response) -> String {
    response
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .expect("x-request-id response header")
        .to_owned()
}

#[tokio::test]
async fn migrations_and_operational_endpoints_work() {
    let Some(database_url) = test_database_url() else {
        eprintln!("skipping foundation database test: TEST_DATABASE_URL is not set");
        return;
    };
    let config = config(&database_url, 2_000);
    let settings = DatabaseSettings::from_config(&config, "answerscope-foundation-test");
    let pool = connect(&settings).await.expect("connect test database");
    migrate(&pool).await.expect("run migrations");

    let applied: i64 = sqlx::query_scalar("SELECT count(*) FROM _sqlx_migrations")
        .fetch_one(&pool)
        .await
        .expect("applied migration count");
    assert!(applied > 0, "migrations must execute");

    let state = Arc::new(AppState::new(pool.clone(), config));
    let (base, server) = spawn(state).await;
    let client = reqwest::Client::new();

    let response = client
        .get(format!("{base}/health"))
        .send()
        .await
        .expect("health response");
    assert_eq!(response.status(), StatusCode::OK);
    let request_id = request_id_header(&response);
    assert!(request_id.starts_with("req-"));
    let body = json(response).await;
    assert_eq!(body["data"]["status"], "ok");
    assert_eq!(body["data"]["environment"], "test");
    assert_eq!(body["meta"]["request_id"], request_id);

    let response = client
        .get(format!("{base}/ready"))
        .send()
        .await
        .expect("readiness response");
    assert_eq!(response.status(), StatusCode::OK);
    let body = json(response).await;
    assert_eq!(body["data"]["status"], "ready");
    assert_eq!(body["data"]["checks"][0]["name"], "postgresql");
    assert_eq!(body["data"]["checks"][0]["status"], "up");
    assert!(body["data"]["checked_at"].is_string());

    let response = client
        .get(format!("{base}/api/v1/system/info"))
        .send()
        .await
        .expect("system info response");
    assert_eq!(response.status(), StatusCode::OK);
    let body = json(response).await;
    assert_eq!(body["data"]["api_version"], "v1");
    assert_eq!(body["data"]["database"], "postgresql");
    assert_eq!(body["data"]["openapi_url"], "/api/v1/openapi.json");
    assert!(
        body["data"]["capabilities"]
            .as_array()
            .expect("capabilities array")
            .iter()
            .any(|value| value == "sqlx-migrations")
    );

    let response = client
        .get(format!("{base}/api/v1/openapi.json"))
        .send()
        .await
        .expect("OpenAPI response");
    assert_eq!(response.status(), StatusCode::OK);
    let body = json(response).await;
    assert!(body["openapi"].as_str().is_some());
    assert!(body["paths"]["/health"]["get"].is_object());
    assert!(body["paths"]["/ready"]["get"].is_object());
    assert!(body["paths"]["/api/v1/system/info"]["get"].is_object());
    assert!(body["paths"]["/api/v1/openapi.json"]["get"].is_object());
    assert!(body["components"]["schemas"]["ReadinessResponse"].is_object());

    // A caller-supplied correlation ID is validated and echoed end to end.
    let supplied = "req-integration-1234";
    let response = client
        .get(format!("{base}/health"))
        .header("x-request-id", supplied)
        .send()
        .await
        .expect("correlated health response");
    assert_eq!(request_id_header(&response), supplied);
    assert_eq!(json(response).await["meta"]["request_id"], supplied);

    // Unsafe or too-short IDs are replaced with a generated ID.
    let response = client
        .get(format!("{base}/health"))
        .header("x-request-id", "unsafe id")
        .send()
        .await
        .expect("invalid correlation ID response");
    let generated = request_id_header(&response);
    assert_ne!(generated, "unsafe id");
    assert!(generated.starts_with("req-"));

    // Unknown routes use the shared error envelope, not an empty 404.
    let response = client
        .get(format!("{base}/api/v1/does-not-exist"))
        .send()
        .await
        .expect("not found response");
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert_eq!(
        response
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok()),
        Some("application/json")
    );
    let body = json(response).await;
    assert_eq!(body["code"], "not_found");
    assert_eq!(body["status"], 404);
    assert!(body["request_id"].as_str().is_some());
    assert!(body["error"].is_string());

    server.abort();
    pool.close().await;
}

#[tokio::test]
async fn readiness_fails_when_database_is_unavailable() {
    // Port 1 on loopback is closed in normal environments, so the lazy pool can
    // never acquire a connection. This proves readiness performs real I/O.
    let unreachable = "postgres://postgres:postgres@127.0.0.1:1/answerscope";
    let config = config(unreachable, 400);
    let settings = DatabaseSettings::from_config(&config, "answerscope-readiness-test");
    let pool = connect_lazy(&settings).expect("lazy pool");
    let state = Arc::new(AppState::new(pool.clone(), config));
    let (base, server) = spawn(state).await;
    let client = reqwest::Client::new();

    // Liveness must remain healthy when PostgreSQL is down.
    let response = client
        .get(format!("{base}/health"))
        .send()
        .await
        .expect("health response");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json(response).await["data"]["status"], "ok");

    let response = client
        .get(format!("{base}/ready"))
        .send()
        .await
        .expect("readiness response");
    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    let body = json(response).await;
    assert_eq!(body["data"]["status"], "not_ready");
    assert_eq!(body["data"]["checks"][0]["status"], "down");
    let code = body["data"]["checks"][0]["error"]
        .as_str()
        .expect("safe readiness error code");
    assert!(
        matches!(code, "database_unavailable" | "database_timeout"),
        "unexpected readiness code: {code}"
    );
    assert!(!code.contains("postgres:postgres"));

    server.abort();
    tokio::time::timeout(Duration::from_secs(2), pool.close())
        .await
        .expect("lazy pool closes promptly");
}
