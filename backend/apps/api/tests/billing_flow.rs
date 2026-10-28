use std::{net::SocketAddr, path::PathBuf, sync::Arc};

use answerscope_api::{
    config::{Config, Environment, LogFormat},
    routes,
    services::audits::hash_access_token,
    state::AppState,
};
use chrono::{Duration as ChronoDuration, Utc};
use hmac::{Hmac, Mac};
use serde_json::{Value, json};
use sha2::Sha256;
use sqlx::{PgPool, Row, postgres::PgPoolOptions};
use tokio::net::TcpListener;
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

fn test_database_url() -> String {
    std::env::var("BILLING_TEST_DATABASE_URL")
        .expect("set BILLING_TEST_DATABASE_URL to a disposable PostgreSQL database")
}

async fn settlement(
    client: &reqwest::Client,
    base: &str,
    token: &str,
    secret: &str,
    event: Value,
) -> reqwest::Response {
    let body = serde_json::to_vec(&event).unwrap();
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(&body);
    let signature = hex::encode(mac.finalize().into_bytes());
    client
        .post(format!("{base}/api/v1/billing/webhooks/manual_invoice"))
        .header("authorization", format!("Bearer {token}"))
        .header("content-type", "application/json")
        .header("x-answerscope-signature", format!("sha256={signature}"))
        .body(body)
        .send()
        .await
        .unwrap()
}

async fn fixture(pool: &PgPool) -> (Uuid, Uuid, String) {
    let organization_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let token = format!("billing-test-{}", Uuid::new_v4());
    sqlx::query("INSERT INTO organizations(id,name) VALUES($1,'Billing integration test')")
        .bind(organization_id)
        .execute(pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO users(id,email,display_name,email_verified) VALUES($1,$2,'Billing test',TRUE)",
    )
    .bind(user_id)
    .bind(format!("{user_id}@example.test"))
    .execute(pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO memberships(organization_id,user_id,role) VALUES($1,$2,'owner')")
        .bind(organization_id)
        .bind(user_id)
        .execute(pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO sessions(user_id,token_hash,csrf_secret_hash,expires_at) VALUES($1,$2,'test',now()+interval '1 hour')")
        .bind(user_id)
        .bind(hash_access_token(&token))
        .execute(pool)
        .await
        .unwrap();
    (organization_id, user_id, token)
}

fn config(database_url: String, secret: &str) -> Config {
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
        report_storage_dir: PathBuf::from("/tmp/answerscope-billing-test-reports"),
        report_anonymous_monthly_limit: 10,
        billing_manual_settlement_secret: Some(secret.to_owned()),
        billing_manual_payment_instructions: "test transfer instructions".into(),
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

#[tokio::test]
async fn manual_checkout_settlement_renewal_and_tenant_access() {
    let database_url = test_database_url();
    let pool = PgPoolOptions::new()
        .max_connections(8)
        .connect(&database_url)
        .await
        .expect("connect to disposable PostgreSQL");
    sqlx::migrate!("../../migrations").run(&pool).await.unwrap();
    let secret = format!("test-settlement-secret-{}", Uuid::new_v4());
    let app_state = Arc::new(AppState::new(
        pool.clone(),
        config(database_url.clone(), &secret),
    ));
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        axum::serve(listener, routes::router(app_state))
            .await
            .unwrap();
    });
    let base = format!("http://{address}");
    let client = reqwest::Client::new();
    let (organization_id, _user_id, token) = fixture(&pool).await;

    let plan_version: Uuid = sqlx::query_scalar(
        "SELECT pv.id FROM plan_versions pv JOIN plans p ON p.id=pv.plan_id WHERE p.plan_key='starter' AND pv.version=1",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    let unpublished_plans: Value = client
        .get(format!("{base}/api/v1/billing/plans"))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let starter = unpublished_plans["plans"]
        .as_array()
        .unwrap()
        .iter()
        .find(|plan| plan["plan_key"] == "starter")
        .unwrap();
    assert_eq!(starter["prices"].as_array().unwrap().len(), 0);
    sqlx::query("UPDATE plan_versions SET publication_status='public' WHERE id=$1")
        .bind(plan_version)
        .execute(&pool)
        .await
        .unwrap();
    let price_id = Uuid::new_v4();
    sqlx::query("INSERT INTO plan_prices(id,plan_version_id,billing_interval,amount_minor,currency,enabled) VALUES($1,$2,'monthly',1900,'USD',true)")
        .bind(price_id)
        .bind(plan_version)
        .execute(&pool)
        .await
        .unwrap();

    let checkout = client
        .post(format!("{base}/api/v1/billing/checkout"))
        .bearer_auth(&token)
        .json(&json!({"organization_id":organization_id,"price_id":price_id,"idempotency_key":format!("checkout-{organization_id}")}))
        .send()
        .await
        .unwrap();
    assert_eq!(checkout.status(), 202);
    let checkout: Value = checkout.json().await.unwrap();
    let subscription_id = checkout["subscription_id"].as_str().unwrap();
    let invoice_id = checkout["invoice_id"].as_str().unwrap();
    assert_eq!(checkout["status"], "pending_payment");
    let repeated_checkout = client
        .post(format!("{base}/api/v1/billing/checkout"))
        .bearer_auth(&token)
        .json(&json!({"organization_id":organization_id,"price_id":price_id,"idempotency_key":format!("checkout-{organization_id}")}))
        .send()
        .await
        .unwrap();
    assert_eq!(repeated_checkout.status(), 202);
    let repeated_checkout: Value = repeated_checkout.json().await.unwrap();
    assert_eq!(repeated_checkout["invoice_id"], invoice_id);
    assert_eq!(repeated_checkout["subscription_id"], subscription_id);
    assert_eq!(repeated_checkout["status"], "pending_payment");

    let failure_time = Utc::now() - ChronoDuration::minutes(2);
    let failed_event = json!({"event_id":format!("failed-{invoice_id}"),"event_type":"payment_failed","invoice_id":invoice_id,"provider_reference":format!("failed-ref-{invoice_id}"),"amount_minor":1900,"currency":"USD","occurred_at":failure_time,"reason":"test failure"});
    let failed = settlement(&client, &base, &token, &secret, failed_event).await;
    assert!(failed.status().is_success());
    let (pending_status, overdue_status): (String, String) = sqlx::query_as(
        "SELECT s.status,i.status FROM subscriptions s JOIN invoices i ON i.subscription_id=s.id WHERE s.id=$1",
    )
    .bind(Uuid::parse_str(subscription_id).unwrap())
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(pending_status, "pending_payment");
    assert_eq!(overdue_status, "overdue");

    let success_time = Utc::now();
    let success_event = json!({"event_id":format!("success-{invoice_id}"),"event_type":"payment_succeeded","invoice_id":invoice_id,"provider_reference":format!("success-ref-{invoice_id}"),"amount_minor":1900,"currency":"USD","occurred_at":success_time,"reason":null});
    let success = settlement(&client, &base, &token, &secret, success_event.clone()).await;
    assert!(success.status().is_success());
    let duplicate = settlement(&client, &base, &token, &secret, success_event.clone()).await;
    assert!(duplicate.status().is_success());
    let invalid_signature = client
        .post(format!("{base}/api/v1/billing/webhooks/manual_invoice"))
        .header("x-answerscope-signature", "sha256=00")
        .header("content-type", "application/json")
        .body(serde_json::to_vec(&success_event).unwrap())
        .send()
        .await
        .unwrap();
    assert_eq!(invalid_signature.status(), 401);

    let sub = sqlx::query("SELECT status,is_current FROM subscriptions WHERE id=$1")
        .bind(Uuid::parse_str(subscription_id).unwrap())
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(sub.get::<String, _>("status"), "active");
    assert!(sub.get::<bool, _>("is_current"));
    let paid: bool = sqlx::query_scalar("SELECT status='paid' FROM invoices WHERE id=$1")
        .bind(Uuid::parse_str(invoice_id).unwrap())
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(paid);
    let payment_count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM payments WHERE invoice_id=$1")
            .bind(Uuid::parse_str(invoice_id).unwrap())
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(
        payment_count, 2,
        "failed attempt and successful settlement recorded once each"
    );

    let successful_payment: Uuid =
        sqlx::query_scalar("SELECT id FROM payments WHERE invoice_id=$1 AND status='succeeded'")
            .bind(Uuid::parse_str(invoice_id).unwrap())
            .fetch_one(&pool)
            .await
            .unwrap();
    let refund_request = client
        .post(format!("{base}/api/v1/billing/refunds"))
        .bearer_auth(&token)
        .json(&json!({"organization_id":organization_id,"payment_id":successful_payment,"amount_minor":500,"reason":"Integration flow partial refund"}))
        .send()
        .await
        .unwrap();
    assert_eq!(refund_request.status(), 202);
    let refund_request: Value = refund_request.json().await.unwrap();
    let refund_id = refund_request["refund_id"].as_str().unwrap();
    let refund_settlement = settlement(
        &client,
        &base,
        &token,
        &secret,
        json!({"event_id":format!("refund-{refund_id}"),"event_type":"refund_succeeded","invoice_id":invoice_id,"refund_id":refund_id,"provider_reference":format!("refund-provider-{refund_id}"),"amount_minor":500,"currency":"USD","occurred_at":Utc::now(),"reason":"Refund sent"}),
    )
    .await;
    let refund_status_code = refund_settlement.status();
    assert!(
        refund_status_code.is_success(),
        "refund settlement response: {} {}",
        refund_status_code,
        refund_settlement.text().await.unwrap()
    );
    let payment_status: String = sqlx::query_scalar("SELECT status FROM payments WHERE id=$1")
        .bind(successful_payment)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(payment_status, "partially_refunded");
    let refund_status: String = sqlx::query_scalar("SELECT status FROM refunds WHERE id=$1")
        .bind(Uuid::parse_str(refund_id).unwrap())
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(refund_status, "succeeded");
    let too_much_refund = client
        .post(format!("{base}/api/v1/billing/refunds"))
        .bearer_auth(&token)
        .json(&json!({"organization_id":organization_id,"payment_id":successful_payment,"amount_minor":1500,"reason":"Must exceed remaining balance"}))
        .send()
        .await
        .unwrap();
    assert_eq!(too_much_refund.status(), 422);
    let final_refund = client
        .post(format!("{base}/api/v1/billing/refunds"))
        .bearer_auth(&token)
        .json(&json!({"organization_id":organization_id,"payment_id":successful_payment,"amount_minor":1400,"reason":"Remaining refund amount"}))
        .send()
        .await
        .unwrap();
    assert_eq!(final_refund.status(), 202);
    let final_refund: Value = final_refund.json().await.unwrap();
    let final_refund_id = final_refund["refund_id"].as_str().unwrap();
    let final_refund_settlement = settlement(
        &client,
        &base,
        &token,
        &secret,
        json!({"event_id":format!("refund-final-{final_refund_id}"),"event_type":"refund_succeeded","invoice_id":invoice_id,"refund_id":final_refund_id,"provider_reference":format!("refund-provider-{final_refund_id}"),"amount_minor":1400,"currency":"USD","occurred_at":Utc::now(),"reason":"Remaining amount returned"}),
    )
    .await;
    assert!(final_refund_settlement.status().is_success());
    let (payment_status, invoice_status): (String, String) = sqlx::query_as(
        "SELECT p.status,i.status FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE p.id=$1",
    )
    .bind(successful_payment)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(payment_status, "refunded");
    assert_eq!(invoice_status, "refunded");

    let best_value_version: Uuid = sqlx::query_scalar(
        "SELECT pv.id FROM plan_versions pv JOIN plans p ON p.id=pv.plan_id WHERE p.plan_key='best_value' AND pv.version=1",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    sqlx::query("UPDATE plan_versions SET publication_status='public' WHERE id=$1")
        .bind(best_value_version)
        .execute(&pool)
        .await
        .unwrap();
    let best_value_price = Uuid::new_v4();
    sqlx::query("INSERT INTO plan_prices(id,plan_version_id,billing_interval,amount_minor,currency,enabled) VALUES($1,$2,'monthly',4900,'USD',true)")
        .bind(best_value_price)
        .bind(best_value_version)
        .execute(&pool)
        .await
        .unwrap();
    let upgrade_key = format!("upgrade-{organization_id}");
    let upgrade = client
        .post(format!("{base}/api/v1/billing/change-plan"))
        .bearer_auth(&token)
        .json(&json!({"organization_id":organization_id,"price_id":best_value_price,"idempotency_key":upgrade_key}))
        .send()
        .await
        .unwrap();
    assert_eq!(upgrade.status(), 202);
    let upgrade: Value = upgrade.json().await.unwrap();
    let upgrade_invoice = upgrade["invoice_id"].as_str().unwrap();
    let upgrade_amount = upgrade["amount_minor"].as_i64().unwrap();
    let upgrade_paid = settlement(
        &client,
        &base,
        &token,
        &secret,
        json!({"event_id":format!("upgrade-{upgrade_invoice}"),"event_type":"payment_succeeded","invoice_id":upgrade_invoice,"provider_reference":format!("upgrade-ref-{upgrade_invoice}"),"amount_minor":upgrade_amount,"currency":"USD","occurred_at":Utc::now(),"reason":null}),
    )
    .await;
    assert!(upgrade_paid.status().is_success());
    let upgraded_plan: String = sqlx::query_scalar("SELECT p.plan_key FROM subscriptions s JOIN plan_versions pv ON pv.id=s.plan_version_id JOIN plans p ON p.id=pv.plan_id WHERE s.id=$1")
        .bind(Uuid::parse_str(subscription_id).unwrap())
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(upgraded_plan, "best_value");
    let starter_change = client
        .post(format!("{base}/api/v1/billing/change-plan"))
        .bearer_auth(&token)
        .json(&json!({"organization_id":organization_id,"price_id":price_id,"idempotency_key":format!("downgrade-{organization_id}")}))
        .send()
        .await
        .unwrap();
    assert!(starter_change.status().is_success());
    let starter_change: Value = starter_change.json().await.unwrap();
    assert_eq!(starter_change["effective"], "immediate");
    assert_eq!(starter_change["plan_key"], "starter");

    // A late failed event for an already-paid invoice must not revoke access.
    let stale = settlement(
        &client,
        &base,
        &token,
        &secret,
        json!({"event_id":format!("stale-{invoice_id}"),"event_type":"payment_failed","invoice_id":invoice_id,"provider_reference":format!("stale-ref-{invoice_id}"),"amount_minor":1900,"currency":"USD","occurred_at":failure_time,"reason":"late notification"}),
    )
    .await;
    assert!(stale.status().is_success());
    let active: bool = sqlx::query_scalar("SELECT status='active' FROM subscriptions WHERE id=$1")
        .bind(Uuid::parse_str(subscription_id).unwrap())
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(active);

    // Trigger a real renewal boundary and settle the generated invoice.
    sqlx::query(
        "UPDATE subscriptions SET current_period_end=now()-interval '1 second' WHERE id=$1",
    )
    .bind(Uuid::parse_str(subscription_id).unwrap())
    .execute(&pool)
    .await
    .unwrap();
    answerscope_api::billing::process_due(&pool).await.unwrap();
    let renewal = sqlx::query("SELECT id,total_minor,currency::text,period_end FROM invoices WHERE subscription_id=$1 AND invoice_kind='renewal' ORDER BY created_at DESC LIMIT 1")
        .bind(Uuid::parse_str(subscription_id).unwrap())
        .fetch_one(&pool)
        .await
        .unwrap();
    let renewal_id: Uuid = renewal.get("id");
    let renewal_amount: i64 = renewal.get("total_minor");
    let renewal_currency: String = renewal.get("currency");
    let renewal_success = settlement(
        &client,
        &base,
        &token,
        &secret,
        json!({"event_id":format!("renewal-{renewal_id}"),"event_type":"payment_succeeded","invoice_id":renewal_id,"provider_reference":format!("renewal-ref-{renewal_id}"),"amount_minor":renewal_amount,"currency":renewal_currency,"occurred_at":Utc::now(),"reason":null}),
    )
    .await;
    assert!(renewal_success.status().is_success());
    let (renewed_status, renewed_end): (String, chrono::DateTime<Utc>) =
        sqlx::query_as("SELECT status,current_period_end FROM subscriptions WHERE id=$1")
            .bind(Uuid::parse_str(subscription_id).unwrap())
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(renewed_status, "active");
    assert!(renewed_end > Utc::now());

    let scheduled_cancel = client
        .post(format!("{base}/api/v1/billing/cancel"))
        .bearer_auth(&token)
        .json(&json!({"organization_id":organization_id,"at_period_end":true}))
        .send()
        .await
        .unwrap();
    assert!(scheduled_cancel.status().is_success());
    let scheduled_cancel: Value = scheduled_cancel.json().await.unwrap();
    assert_eq!(scheduled_cancel["cancel_at_period_end"], true);
    let reactivated = client
        .post(format!("{base}/api/v1/billing/reactivate"))
        .bearer_auth(&token)
        .json(&json!({"organization_id":organization_id}))
        .send()
        .await
        .unwrap();
    assert!(reactivated.status().is_success());
    let immediate_cancel = client
        .post(format!("{base}/api/v1/billing/cancel"))
        .bearer_auth(&token)
        .json(&json!({"organization_id":organization_id,"at_period_end":false}))
        .send()
        .await
        .unwrap();
    assert!(immediate_cancel.status().is_success());
    let free_plan: String = sqlx::query_scalar("SELECT p.plan_key FROM subscriptions s JOIN plan_versions pv ON pv.id=s.plan_version_id JOIN plans p ON p.id=pv.plan_id WHERE s.organization_id=$1 AND s.is_current")
        .bind(organization_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(free_plan, "free");

    // Membership checks prevent a different tenant from reading this subscription.
    let other_org = Uuid::new_v4();
    sqlx::query("INSERT INTO organizations(id,name) VALUES($1,'Other tenant')")
        .bind(other_org)
        .execute(&pool)
        .await
        .unwrap();
    let forbidden = client
        .get(format!(
            "{base}/api/v1/billing/subscription?organization_id={other_org}"
        ))
        .bearer_auth(&token)
        .send()
        .await
        .unwrap();
    assert_eq!(forbidden.status(), 404);

    sqlx::query("DELETE FROM organizations WHERE id IN ($1,$2)")
        .bind(organization_id)
        .bind(other_org)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM plan_prices WHERE id IN ($1,$2)")
        .bind(price_id)
        .bind(best_value_price)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE plan_versions SET publication_status='internal_unvalidated_economics' WHERE plan_id IN (SELECT id FROM plans WHERE plan_key IN ('starter','best_value')) AND version=1")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM users WHERE id=$1")
        .bind(_user_id)
        .execute(&pool)
        .await
        .unwrap();
    server.abort();
    pool.close().await;
}
