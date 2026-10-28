use std::time::Duration;

use anyhow::Context;
use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
};
use serde::Serialize;
use serde_json::{Value, json};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::{config::Config, error::ApiError, state::AppState};

#[derive(Serialize, FromRow)]
struct Notification {
    id: Uuid,
    organization_id: Option<Uuid>,
    notification_type: String,
    title: String,
    body: String,
    action_url: Option<String>,
    data: Value,
    read_at: Option<chrono::DateTime<chrono::Utc>>,
    created_at: chrono::DateTime<chrono::Utc>,
}

pub fn routes() -> Router<std::sync::Arc<AppState>> {
    Router::new()
        .route("/api/v1/notifications", get(list_notifications))
        .route("/api/v1/notifications/{id}/read", post(mark_read))
        .route("/api/v1/notifications/email-status", get(email_status))
}

async fn list_notifications(
    State(state): State<std::sync::Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<Notification>>, ApiError> {
    let user = crate::auth::session_user(&state.pool, &headers).await?;
    let rows = sqlx::query_as("SELECT id,organization_id,notification_type,title,body,action_url,data,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100")
        .bind(user).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    Ok(Json(rows))
}

async fn mark_read(
    State(state): State<std::sync::Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    crate::auth::require_csrf(&state.pool, &headers).await?;
    let user = crate::auth::session_user(&state.pool, &headers).await?;
    let changed = sqlx::query(
        "UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2",
    )
    .bind(id)
    .bind(user)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    if changed.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn email_status(State(state): State<std::sync::Arc<AppState>>) -> Json<Value> {
    Json(
        json!({"provider":"resend","configured":state.config.resend_api_key.is_some(),"status":if state.config.resend_api_key.is_some(){"ready"}else{"disconnected"}}),
    )
}

#[derive(FromRow)]
struct ClaimedEmail {
    id: Uuid,
    recipient: String,
    template_key: String,
    subject: String,
    payload: Value,
    attempts: i32,
}

/// Processes one durable outbox email. With no provider credentials queued mail is retained and
/// reported as disconnected; the worker never pretends a message was delivered.
pub async fn process_email_next(
    pool: &PgPool,
    config: &Config,
    worker_id: &str,
) -> anyhow::Result<bool> {
    let Some(api_key) = config.resend_api_key.as_deref() else {
        return Ok(false);
    };
    sqlx::query("UPDATE email_outbox SET status='queued',locked_by=NULL,lease_expires_at=NULL,available_at=now() WHERE status='sending' AND lease_expires_at<now()")
        .execute(pool).await?;
    let job: Option<ClaimedEmail> = sqlx::query_as("WITH next AS (SELECT id FROM email_outbox WHERE status='queued' AND available_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE email_outbox e SET status='sending',attempts=attempts+1,locked_by=$1,lease_expires_at=now()+interval '2 minutes' FROM next WHERE e.id=next.id RETURNING e.id,e.recipient,e.template_key,e.subject,e.payload,e.attempts")
        .bind(worker_id).fetch_optional(pool).await?;
    let Some(mut job) = job else { return Ok(false) };
    job.attempts = job.attempts.max(1);
    let (text, html) = match render_message(&job.template_key, &job.payload) {
        Ok(message) => message,
        Err(error) => {
            sqlx::query("UPDATE email_outbox SET status='failed',last_error='Invalid or unsupported email template',locked_by=NULL,lease_expires_at=NULL WHERE id=$1")
                .bind(job.id).execute(pool).await?;
            tracing::error!(email_id=%job.id, error=%error, "email outbox item rejected");
            return Ok(true);
        }
    };
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()?;
    let result = client.post("https://api.resend.com/emails")
        .bearer_auth(api_key)
        .json(&json!({"from":config.email_from,"to":[job.recipient],"subject":job.subject,"text":text,"html":html}))
        .send().await;
    match result {
        Ok(response) if response.status().is_success() => {
            let body: Value = response.json().await.unwrap_or(Value::Null);
            sqlx::query("UPDATE email_outbox SET status='sent',provider_message_id=$2,sent_at=now(),locked_by=NULL,lease_expires_at=NULL,last_error=NULL WHERE id=$1")
                .bind(job.id).bind(body.get("id").and_then(Value::as_str)).execute(pool).await?;
        }
        Ok(response) => {
            retry_email(
                pool,
                job.id,
                job.attempts,
                format!("Resend returned HTTP {}", response.status().as_u16()),
            )
            .await?
        }
        Err(error) => {
            retry_email(
                pool,
                job.id,
                job.attempts,
                if error.is_timeout() {
                    "Resend request timed out".into()
                } else {
                    "Resend request failed".into()
                },
            )
            .await?
        }
    }
    Ok(true)
}

async fn retry_email(pool: &PgPool, id: Uuid, attempts: i32, reason: String) -> anyhow::Result<()> {
    if attempts >= 8 {
        sqlx::query("UPDATE email_outbox SET status='failed',last_error=$2,locked_by=NULL,lease_expires_at=NULL WHERE id=$1")
            .bind(id).bind(reason).execute(pool).await?;
    } else {
        let delay = (1_i64 << attempts.min(10)).min(3600);
        sqlx::query("UPDATE email_outbox SET status='queued',last_error=$2,locked_by=NULL,lease_expires_at=NULL,available_at=now()+make_interval(secs=>$3) WHERE id=$1")
            .bind(id).bind(reason).bind(delay as f64).execute(pool).await?;
    }
    Ok(())
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn render_message(template: &str, payload: &Value) -> anyhow::Result<(String, String)> {
    match template {
        "verify_email" => {
            let url = payload
                .get("verification_url")
                .and_then(Value::as_str)
                .context("verification URL is missing")?;
            let name = payload
                .get("display_name")
                .and_then(Value::as_str)
                .filter(|v| !v.is_empty())
                .unwrap_or("there");
            let escaped_url = escape_html(url);
            let escaped_name = escape_html(name);
            Ok((
                format!(
                    "Hello {name}, verify your AnswerScope email by opening: {url}\nThis link expires in 30 minutes."
                ),
                format!(
                    "<p>Hello {escaped_name},</p><p>Verify your AnswerScope email:</p><p><a href=\"{escaped_url}\">Verify email address</a></p><p>This link expires in 30 minutes.</p>"
                ),
            ))
        }
        "organization_invitation" => {
            let url = payload
                .get("invitation_url")
                .and_then(Value::as_str)
                .context("invitation URL is missing")?;
            let organization = payload
                .get("organization_name")
                .and_then(Value::as_str)
                .unwrap_or("an AnswerScope organization");
            let role = payload
                .get("role")
                .and_then(Value::as_str)
                .unwrap_or("member");
            let escaped_url = escape_html(url);
            let escaped_org = escape_html(organization);
            let escaped_role = escape_html(role);
            Ok((
                format!(
                    "You were invited to join {organization} as {role}. Accept the invitation: {url}"
                ),
                format!(
                    "<p>You were invited to join <strong>{escaped_org}</strong> as {escaped_role}.</p><p><a href=\"{escaped_url}\">Review invitation</a></p>"
                ),
            ))
        }
        "password_reset" => {
            let url = payload
                .get("reset_url")
                .and_then(Value::as_str)
                .context("password reset URL is missing")?;
            let escaped_url = escape_html(url);
            Ok((
                format!(
                    "Reset your AnswerScope password by opening: {url}\nThis link expires in 30 minutes. If you did not request this, you can ignore this email."
                ),
                format!(
                    "<p>We received a request to reset your AnswerScope password.</p><p><a href=\"{escaped_url}\">Choose a new password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>"
                ),
            ))
        }
        _ => anyhow::bail!("unsupported email template"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reset_template_contains_url_and_is_html_escaped() {
        let (_, html) = render_message(
            "password_reset",
            &json!({"reset_url":"https://app.example/reset?token=a&x=<b>"}),
        )
        .unwrap();
        assert!(html.contains("token=a&amp;x=&lt;b&gt;"));
        assert!(!html.contains("token=a&x=<b>"));
    }

    #[test]
    fn unsupported_template_is_rejected() {
        assert!(render_message("arbitrary_html", &Value::Null).is_err());
    }
}
