use std::{net::SocketAddr, path::PathBuf, sync::Arc};

use answerscope_api::{
    config::{Config, Environment, LogFormat},
    routes,
    state::AppState,
};
use axum::http::header;
use serde_json::{Value, json};
use sqlx::{PgPool, postgres::PgPoolOptions};
use tokio::net::TcpListener;
use uuid::Uuid;

fn database_url() -> String {
    std::env::var("BILLING_TEST_DATABASE_URL")
        .expect("set BILLING_TEST_DATABASE_URL to a disposable PostgreSQL database")
}

fn config(database_url: String) -> Config {
    Config {
        bind_addr: "127.0.0.1:0".parse::<SocketAddr>().unwrap(),
        database_url,
        database_max_connections: 8,
        environment: Environment::Test,
        log_format: LogFormat::Json,
        database_connect_timeout_secs: 5,
        database_acquire_timeout_secs: 5,
        readiness_timeout_ms: 2_000,
        shutdown_timeout_secs: 5,
        crawl_page_limit: 10,
        crawl_max_depth: 2,
        crawl_response_byte_limit: 1_000_000,
        crawl_min_request_interval_ms: 0,
        crawl_request_timeout_secs: 5,
        crawl_max_redirects: 2,
        crawl_cache_ttl_secs: 0,
        pagespeed_api_key: None,
        google_oauth_client_id: None,
        google_oauth_client_secret: None,
        report_storage_dir: PathBuf::from("/tmp/answerscope-auth-test-reports"),
        report_anonymous_monthly_limit: 10,
        billing_manual_settlement_secret: None,
        billing_manual_payment_instructions: "test only".into(),
        billing_invoice_due_days: 14,
        workos_client_id: None,
        workos_api_key: None,
        workos_redirect_uri: "http://localhost:8080/api/v1/auth/workos/callback".into(),
        app_base_url: "http://localhost:3000".into(),
        auth_cookie_secure: false,
        resend_api_key: None,
        email_from: "AnswerScope <no-reply@example.test>".into(),
        frontend_origin: "http://localhost:3000".into(),
    }
}

async fn register_and_verify(
    client: &reqwest::Client,
    base: &str,
    pool: &PgPool,
    email: &str,
    password: &str,
) -> (Uuid, String, String) {
    let response = client
        .post(format!("{base}/api/v1/auth/register"))
        .json(&json!({"email":email,"password":password,"display_name":"Auth Test"}))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 202);
    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE email=$1")
        .bind(email)
        .fetch_one(pool)
        .await
        .unwrap();
    let payload: Value = sqlx::query_scalar("SELECT payload FROM email_outbox WHERE recipient=$1 AND template_key='verify_email' ORDER BY created_at DESC LIMIT 1")
        .bind(email).fetch_one(pool).await.unwrap();
    let verification_url = payload["verification_url"].as_str().unwrap();
    let token = url::Url::parse(verification_url)
        .unwrap()
        .query_pairs()
        .find(|(key, _)| key == "token")
        .unwrap()
        .1
        .to_string();
    let response = client
        .post(format!("{base}/api/v1/auth/verify-email"))
        .json(&json!({"token":token}))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let cookies: Vec<String> = response
        .headers()
        .get_all(header::SET_COOKIE)
        .iter()
        .map(|value| value.to_str().unwrap().to_owned())
        .collect();
    let session = cookies
        .iter()
        .find(|value| value.starts_with("answerscope_session="))
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_owned();
    let csrf = cookies
        .iter()
        .find(|value| value.starts_with("answerscope_csrf="))
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_owned();
    let csrf_value = csrf.split_once('=').unwrap().1.to_owned();
    (user_id, format!("{session}; {csrf}"), csrf_value)
}

#[tokio::test]
async fn local_auth_memberships_roles_notifications_and_logout() {
    let database_url = database_url();
    let pool = PgPoolOptions::new()
        .max_connections(8)
        .connect(&database_url)
        .await
        .unwrap();
    sqlx::migrate!("../../migrations").run(&pool).await.unwrap();
    let owner_email = format!("owner-{}@example.test", Uuid::new_v4());
    let member_email = format!("member-{}@example.test", Uuid::new_v4());
    let password = "a-long-test-password-9631";
    let state = Arc::new(AppState::new(pool.clone(), config(database_url.clone())));
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        axum::serve(listener, routes::router(state)).await.unwrap();
    });
    let client = reqwest::Client::new();
    let base = format!("http://{address}");
    let (owner_id, owner_cookie, owner_csrf) =
        register_and_verify(&client, &base, &pool, &owner_email, password).await;
    let me_response = client
        .get(format!("{base}/api/v1/auth/me"))
        .header(header::COOKIE, &owner_cookie)
        .send()
        .await
        .unwrap();
    let me_status = me_response.status();
    let me_body = me_response.text().await.unwrap();
    assert_eq!(me_status, 200, "/auth/me response: {me_body}");
    let me: Value = serde_json::from_str(&me_body).unwrap();
    assert_eq!(me["user"]["email"], owner_email);
    assert_eq!(me["organizations"][0]["role"], "owner");
    let created = client
        .post(format!("{base}/api/v1/organizations"))
        .header(header::COOKIE, &owner_cookie)
        .header("x-csrf-token", &owner_csrf)
        .json(&json!({"name":"AnswerScope Auth Test Org"}))
        .send()
        .await
        .unwrap();
    assert_eq!(created.status(), 201);
    let created: Value = created.json().await.unwrap();
    let org = created["organization_id"].as_str().unwrap();
    let org_id = Uuid::parse_str(org).unwrap();
    let invite = client
        .post(format!("{base}/api/v1/organizations/{org}/invitations"))
        .header(header::COOKIE, &owner_cookie)
        .header("x-csrf-token", &owner_csrf)
        .json(&json!({"email":member_email,"role":"analyst"}))
        .send()
        .await
        .unwrap();
    assert_eq!(invite.status(), 201);
    let invite_payload:Value=sqlx::query_scalar("SELECT payload FROM email_outbox WHERE recipient=$1 AND template_key='organization_invitation' ORDER BY created_at DESC LIMIT 1")
        .bind(&member_email).fetch_one(&pool).await.unwrap();
    let invite_url = url::Url::parse(invite_payload["invitation_url"].as_str().unwrap()).unwrap();
    let invite_token = invite_url
        .query_pairs()
        .find(|(key, _)| key == "token")
        .unwrap()
        .1
        .to_string();
    let (member_id, member_cookie, member_csrf) =
        register_and_verify(&client, &base, &pool, &member_email, password).await;
    let accepted = client
        .post(format!("{base}/api/v1/invitations/accept"))
        .header(header::COOKIE, &member_cookie)
        .header("x-csrf-token", &member_csrf)
        .json(&json!({"token":invite_token}))
        .send()
        .await
        .unwrap();
    assert_eq!(accepted.status(), 200);
    let role: String = sqlx::query_scalar(
        "SELECT role::text FROM memberships WHERE organization_id=$1 AND user_id=$2",
    )
    .bind(org_id)
    .bind(member_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(role, "analyst");
    let forbidden = client
        .patch(format!(
            "{base}/api/v1/organizations/{org}/members/{owner_id}"
        ))
        .header(header::COOKIE, &member_cookie)
        .header("x-csrf-token", &member_csrf)
        .json(&json!({"role":"viewer"}))
        .send()
        .await
        .unwrap();
    assert_eq!(forbidden.status(), 401);
    let inbox: Value = client
        .get(format!("{base}/api/v1/notifications"))
        .header(header::COOKIE, &member_cookie)
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert!(
        inbox
            .as_array()
            .unwrap()
            .iter()
            .any(|item| item["notification_type"] == "organization.joined")
    );
    let logout = client
        .post(format!("{base}/api/v1/auth/logout"))
        .header(header::COOKIE, &owner_cookie)
        .header("x-csrf-token", &owner_csrf)
        .send()
        .await
        .unwrap();
    assert_eq!(logout.status(), 204);
    assert_eq!(
        client
            .get(format!("{base}/api/v1/auth/me"))
            .header(header::COOKIE, &owner_cookie)
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    let organization_ids: Vec<Uuid> =
        sqlx::query_scalar("SELECT organization_id FROM memberships WHERE user_id=ANY($1)")
            .bind(vec![owner_id, member_id])
            .fetch_all(&pool)
            .await
            .unwrap();
    sqlx::query("DELETE FROM organizations WHERE id=ANY($1)")
        .bind(organization_ids)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM email_outbox WHERE recipient=ANY($1)")
        .bind(vec![owner_email, member_email])
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM users WHERE id=ANY($1)")
        .bind(vec![owner_id, member_id])
        .execute(&pool)
        .await
        .unwrap();
    server.abort();
}
