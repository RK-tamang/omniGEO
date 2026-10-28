use base64::Engine;
use std::{sync::Arc, time::Duration};

use axum::{
    Json, Router,
    extract::{Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Redirect, Response},
    routing::{get, post},
};
use bcrypt;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::{error::ApiError, state::AppState};

const SESSION_COOKIE: &str = "answerscope_session";
const CSRF_COOKIE: &str = "answerscope_csrf";
const SESSION_SECONDS: i64 = 60 * 60 * 24 * 14;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/v1/auth/register", post(register))
        .route("/api/v1/auth/login", post(login))
        .route("/api/v1/auth/verify-email", post(verify_email))
        .route("/api/v1/auth/password-reset", post(request_password_reset))
        .route(
            "/api/v1/auth/password-reset/complete",
            post(complete_password_reset),
        )
        .route("/api/v1/auth/logout", post(logout))
        .route("/api/v1/auth/me", get(me))
        .route("/api/v1/auth/providers", get(provider_status))
        .route("/api/v1/auth/workos/start", get(workos_start))
        .route("/api/v1/auth/workos/callback", get(workos_callback))
        .route(
            "/api/v1/organizations",
            get(list_organizations).post(create_organization),
        )
        .route(
            "/api/v1/organizations/{organization_id}/members",
            get(list_members),
        )
        .route(
            "/api/v1/organizations/{organization_id}/members/{user_id}",
            axum::routing::patch(update_member_role),
        )
        .route(
            "/api/v1/organizations/{organization_id}/invitations",
            post(create_invitation),
        )
        .route("/api/v1/invitations/{token}", get(invitation_preview))
        .route("/api/v1/invitations/accept", post(accept_invitation))
        .route("/api/v1/auth/guest", post(guest))
}

/// ---- Guest session (public free scans) ----

#[derive(Deserialize)]
struct GuestInput {
    plan: Option<String>,
}

#[derive(Serialize)]
struct GuestResponse {
    user: GuestUser,
}

#[derive(Serialize)]
struct GuestUser {
    id: String,
    email: String,
    name: String,
    plan: String,
    workspace_id: String,
}

const GUEST_EMAIL: &str = "guest@omnigeo.local";
const GUEST_NAME: &str = "Guest Explorer";
const GUEST_PLAN: &str = "Starter";

async fn guest(
    State(state): State<Arc<AppState>>,
) -> Result<Response, ApiError> {
    let secure = state.config.auth_cookie_secure;

    // Find or create the shared guest user
    let user_id: Uuid = sqlx::query_scalar(
        "INSERT INTO users(id, email, display_name, password_hash, email_verified, created_at)
         VALUES ($1, $2, $3, $4, TRUE, now())
         ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
         RETURNING id",
    )
    .bind(Uuid::new_v4())
    .bind(GUEST_EMAIL)
    .bind(GUEST_NAME)
    .bind(hash_secret(&random_secret()))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    // Find or create guest organization
    let org_id: Uuid = sqlx::query_scalar(
        "INSERT INTO organizations(id, name, created_at)
         VALUES ($1, $2, now())
         ON CONFLICT (id) DO NOTHING
         RETURNING id",
    )
    .bind(Uuid::new_v4())
    .bind("Guest Workspace")
    .fetch_one(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    // Ensure membership exists
    let _: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO memberships(organization_id, user_id, role, created_at)
         VALUES ($1, $2, 'owner', now())
         ON CONFLICT DO NOTHING
         RETURNING organization_id",
    )
    .bind(org_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    // Find or create guest workspace
    let workspace_id: Uuid = sqlx::query_scalar(
        "INSERT INTO workspaces(id, organization_id, name, created_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (id) DO NOTHING
         RETURNING id",
    )
    .bind(Uuid::new_v4())
    .bind(org_id)
    .bind("Guest Workspace")
    .fetch_one(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    // Find or create guest project (domains reference projects)
    let _project_id: Uuid = sqlx::query_scalar(
        "INSERT INTO projects(id, organization_id, name, workspace_id, created_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (id) DO NOTHING
         RETURNING id",
    )
    .bind(Uuid::new_v4())
    .bind(org_id)
    .bind("Guest Project")
    .bind(workspace_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    // Issue session
    let (token, csrf) = issue_session(&state.pool, user_id, "local", None).await?;

    // Build response with session cookie
    let user = GuestUser {
        id: user_id.to_string(),
        email: GUEST_EMAIL.to_string(),
        name: GUEST_NAME.to_string(),
        plan: GUEST_PLAN.to_string(),
        workspace_id: workspace_id.to_string(),
    };

    let mut response = (StatusCode::OK, Json(GuestResponse { user })).into_response();
    set_session_cookies(&mut response, &token, &csrf, secure);
    Ok(response)
}

#[derive(Deserialize)]
struct RegisterInput {
    email: String,
    password: String,
    display_name: Option<String>,
}
#[derive(Deserialize)]
struct LoginInput {
    email: String,
    password: String,
}
#[derive(Deserialize)]
struct VerifyInput {
    token: String,
}
#[derive(Deserialize)]
struct PasswordResetInput {
    email: String,
}
#[derive(Deserialize)]
struct PasswordResetCompleteInput {
    token: String,
    password: String,
}
#[derive(Deserialize)]
struct WorkosStartQuery {
    screen_hint: Option<String>,
    next: Option<String>,
}
#[derive(Deserialize)]
struct WorkosCallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
    redirect_to: Option<String>,
}
#[derive(Deserialize)]
struct CreateOrganizationInput {
    name: String,
}
#[derive(Deserialize)]
struct UpdateRoleInput {
    role: String,
}
#[derive(Deserialize)]
struct InviteInput {
    email: String,
    role: String,
}
#[derive(Deserialize)]
struct AcceptInviteInput {
    token: String,
}

#[derive(FromRow, Serialize)]
struct MembershipView {
    organization_id: Uuid,
    organization_name: String,
    role: String,
}

fn normalized_email(value: &str) -> Result<String, ApiError> {
    let email = value.trim().to_ascii_lowercase();
    let (local, domain) = email
        .split_once('@')
        .ok_or_else(|| ApiError::Validation("Enter a valid email address.".into()))?;
    if local.is_empty()
        || domain.is_empty()
        || email.len() > 254
        || email.chars().any(char::is_whitespace)
        || !domain.contains('.')
    {
        return Err(ApiError::Validation("Enter a valid email address.".into()));
    }
    Ok(email)
}

fn random_secret() -> String {
    format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple())
}
fn hash_secret(secret: &str) -> String {
    hex::encode(Sha256::digest(secret.as_bytes()))
}
fn session_token(headers: &HeaderMap) -> Result<String, ApiError> {
    if let Some(value) = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
    {
        if !value.is_empty() && value.len() <= 128 {
            return Ok(value.to_owned());
        }
    }
    headers
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .and_then(|cookies| {
            cookies
                .split(';')
                .find_map(|cookie| cookie.trim().strip_prefix(&format!("{SESSION_COOKIE}=")))
        })
        .filter(|value| !value.is_empty() && value.len() <= 128)
        .map(str::to_owned)
        .ok_or(ApiError::Unauthorized)
}

pub async fn session_user(pool: &PgPool, headers: &HeaderMap) -> Result<Uuid, ApiError> {
    let token = session_token(headers)?;
    sqlx::query_scalar("SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.deleted_at IS NULL AND u.email_verified")
        .bind(hash_secret(&token)).fetch_optional(pool).await.map_err(|e|ApiError::Internal(e.into()))?.ok_or(ApiError::Unauthorized)
}

pub async fn authorize_project(
    pool: &PgPool,
    headers: &HeaderMap,
    project_id: Uuid,
    write: bool,
) -> Result<(Uuid, Uuid), ApiError> {
    if write {
        require_csrf(pool, headers).await?;
    }
    let user = session_user(pool, headers).await?;
    let membership: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT p.organization_id,m.role::text FROM projects p JOIN memberships m ON m.organization_id=p.organization_id WHERE p.id=$1 AND m.user_id=$2",
    )
    .bind(project_id).bind(user).fetch_optional(pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    let (organization_id, role) = membership.ok_or(ApiError::NotFound)?;
    if write && role == "viewer" {
        return Err(ApiError::Unauthorized);
    }
    Ok((user, organization_id))
}

pub async fn require_csrf(pool: &PgPool, headers: &HeaderMap) -> Result<(), ApiError> {
    if headers.get(header::AUTHORIZATION).is_some() {
        return Ok(());
    }
    let session = session_token(headers)?;
    let cookies = headers
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let csrf = cookies
        .split(';')
        .find_map(|cookie| cookie.trim().strip_prefix(&format!("{CSRF_COOKIE}=")))
        .ok_or(ApiError::Unauthorized)?;
    let supplied = headers
        .get("x-csrf-token")
        .and_then(|v| v.to_str().ok())
        .ok_or(ApiError::Unauthorized)?;
    if csrf.is_empty() || csrf != supplied {
        return Err(ApiError::Unauthorized);
    }
    let valid:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM sessions WHERE token_hash=$1 AND csrf_secret_hash=$2 AND revoked_at IS NULL AND expires_at>now())")
        .bind(hash_secret(&session)).bind(hash_secret(csrf)).fetch_one(pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    if valid {
        Ok(())
    } else {
        Err(ApiError::Unauthorized)
    }
}

fn set_session_cookies(response: &mut Response, token: &str, csrf: &str, secure: bool) {
    let secure_flag = if secure { "; Secure" } else { "" };
    let session = format!(
        "{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SESSION_SECONDS}{secure_flag}"
    );
    let csrf_cookie = format!(
        "{CSRF_COOKIE}={csrf}; Path=/; SameSite=Lax; Max-Age={SESSION_SECONDS}{secure_flag}"
    );
    if let Ok(value) = HeaderValue::from_str(&session) {
        response.headers_mut().append(header::SET_COOKIE, value);
    }
    if let Ok(value) = HeaderValue::from_str(&csrf_cookie) {
        response.headers_mut().append(header::SET_COOKIE, value);
    }
}

fn clear_session_cookies(response: &mut Response, secure: bool) {
    let secure_flag = if secure { "; Secure" } else { "" };
    for value in [
        format!("{SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0{secure_flag}"),
        format!("{CSRF_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0{secure_flag}"),
    ] {
        if let Ok(value) = HeaderValue::from_str(&value) {
            response.headers_mut().append(header::SET_COOKIE, value);
        }
    }
}

async fn issue_session(
    pool: &PgPool,
    user_id: Uuid,
    provider: &str,
    provider_session_id: Option<&str>,
) -> Result<(String, String), ApiError> {
    let token = random_secret();
    let csrf = random_secret();
    sqlx::query("INSERT INTO sessions(user_id,token_hash,csrf_secret_hash,expires_at,auth_provider,provider_session_id) VALUES($1,$2,$3,now()+make_interval(secs=>$4),$5,$6)")
        .bind(user_id).bind(hash_secret(&token)).bind(hash_secret(&csrf)).bind(SESSION_SECONDS as f64).bind(provider).bind(provider_session_id).execute(pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    Ok((token, csrf))
}

async fn register(
    State(state): State<Arc<AppState>>,
    Json(input): Json<RegisterInput>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let email = normalized_email(&input.email)?;
    if input.password.chars().count() < 12 || input.password.chars().count() > 256 {
        return Err(ApiError::Validation(
            "Password must contain 12 to 256 characters.".into(),
        ));
    }
    let display = input.display_name.as_deref().unwrap_or("").trim();
    if display.len() > 120 {
        return Err(ApiError::Validation(
            "Display name is limited to 120 characters.".into(),
        ));
    }
    let password_hash = bcrypt::hash(input.password, bcrypt::DEFAULT_COST)
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e.to_string())))?;
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE lower(email)=$1)")
            .bind(&email)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    if !exists {
        let user_id = Uuid::new_v4();
        sqlx::query("INSERT INTO users(id,email,display_name,password_hash,email_verified) VALUES($1,$2,$3,$4,FALSE)").bind(user_id).bind(&email).bind(if display.is_empty(){None}else{Some(display)}).bind(password_hash).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        let token = random_secret();
        sqlx::query("INSERT INTO auth_flow_states(state_hash,flow,user_id,email,expires_at) VALUES($1,'email_verification',$2,$3,now()+interval '30 minutes')").bind(hash_secret(&token)).bind(user_id).bind(&email).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        let verify_url = format!(
            "{}/verify-email?token={token}",
            state.config.app_base_url.trim_end_matches('/')
        );
        sqlx::query("INSERT INTO email_outbox(recipient,template_key,subject,payload,idempotency_key) VALUES($1,'verify_email','Verify your AnswerScope email',$2,$3) ON CONFLICT(idempotency_key) DO NOTHING")
            .bind(&email).bind(json!({"display_name":display,"verification_url":verify_url})).bind(format!("verify:{}",user_id)).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    }
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    // Avoid exposing whether an address already has an account.
    Ok((
        StatusCode::ACCEPTED,
        Json(
            json!({"message":"If this address can be registered, we sent an email verification link."}),
        ),
    ))
}

async fn login(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<LoginInput>,
) -> Result<Response, ApiError> {
    let email = normalized_email(&input.email)?;
    let email_hash = hash_secret(&email);
    let lock: Option<DateTime<Utc>> =
        sqlx::query_scalar("SELECT locked_until FROM login_attempts WHERE email_hash=$1")
            .bind(&email_hash)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?
            .flatten();
    if lock.is_some_and(|until| until > Utc::now()) {
        return Err(ApiError::TooManyRequests(
            "Too many attempts. Wait before trying again.".into(),
        ));
    }
    let user:Option<(Uuid,Option<String>,bool)>=sqlx::query_as("SELECT id,password_hash,email_verified FROM users WHERE lower(email)=$1 AND deleted_at IS NULL").bind(&email).fetch_optional(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    let Some((user_id, Some(encoded), true)) = user else {
        record_failed_login(&state.pool, &email_hash).await?;
        return Err(ApiError::Unauthorized);
    };
    let valid = bcrypt::verify(input.password, &encoded).unwrap_or(false);
    if !valid {
        record_failed_login(&state.pool, &email_hash).await?;
        return Err(ApiError::Unauthorized);
    }
    sqlx::query("DELETE FROM login_attempts WHERE email_hash=$1")
        .bind(&email_hash)
        .execute(&state.pool)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    sqlx::query("UPDATE users SET last_login_at=now() WHERE id=$1")
        .bind(user_id)
        .execute(&state.pool)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    ensure_personal_organization(&mut tx, user_id).await?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let (token, csrf) = issue_session(&state.pool, user_id, "local", None).await?;
    let user: Value = sqlx::query_scalar("SELECT jsonb_build_object('id', id, 'email', email, 'display_name', display_name) FROM users WHERE id=$1")
        .bind(user_id).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let mut response = (StatusCode::OK, Json(json!({
        "authenticated": true,
        "session_token": token,
        "csrf_token": csrf,
        "user": user
    }))).into_response();
    set_session_cookies(
        &mut response,
        &token,
        &csrf,
        state.config.auth_cookie_secure,
    );
    if let Some(origin) = headers.get(header::ORIGIN) {
        response
            .headers_mut()
            .insert(header::VARY, HeaderValue::from_static("Origin"));
        let _ = origin;
    }
    Ok(response)
}

async fn record_failed_login(pool: &PgPool, email_hash: &str) -> Result<(), ApiError> {
    sqlx::query("INSERT INTO login_attempts(email_hash,failed_attempts,window_started_at,locked_until) VALUES($1,1,now(),NULL) ON CONFLICT(email_hash) DO UPDATE SET failed_attempts=CASE WHEN login_attempts.window_started_at < now()-interval '15 minutes' THEN 1 ELSE login_attempts.failed_attempts+1 END,window_started_at=CASE WHEN login_attempts.window_started_at < now()-interval '15 minutes' THEN now() ELSE login_attempts.window_started_at END,locked_until=CASE WHEN (CASE WHEN login_attempts.window_started_at < now()-interval '15 minutes' THEN 1 ELSE login_attempts.failed_attempts+1 END)>=8 THEN now()+interval '15 minutes' ELSE NULL END").bind(email_hash).execute(pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    Ok(())
}

async fn verify_email(
    State(state): State<Arc<AppState>>,
    Json(input): Json<VerifyInput>,
) -> Result<Response, ApiError> {
    if input.token.len() > 128 {
        return Err(ApiError::Unauthorized);
    }
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let user_id:Option<Uuid>=sqlx::query_scalar("UPDATE auth_flow_states SET consumed_at=now() WHERE state_hash=$1 AND flow='email_verification' AND consumed_at IS NULL AND expires_at>now() RETURNING user_id").bind(hash_secret(&input.token)).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    let user_id = user_id.ok_or(ApiError::Unauthorized)?;
    sqlx::query("UPDATE users SET email_verified=TRUE WHERE id=$1 AND deleted_at IS NULL")
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    ensure_personal_organization(&mut tx, user_id).await?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let (token, csrf) = issue_session(&state.pool, user_id, "local", None).await?;
    let mut response = Json(json!({"authenticated":true,"email_verified":true,"session_token":token,"csrf_token":csrf})).into_response();
    set_session_cookies(
        &mut response,
        &token,
        &csrf,
        state.config.auth_cookie_secure,
    );
    Ok(response)
}

async fn request_password_reset(
    State(state): State<Arc<AppState>>,
    Json(input): Json<PasswordResetInput>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let email = normalized_email(&input.email)?;
    // Password reset is deliberately generic; throttle by a one-way address hash so
    // unauthenticated callers cannot enumerate accounts or flood a recipient.
    let email_key = hash_secret(&email);
    let allowed: bool = sqlx::query_scalar("INSERT INTO auth_request_limits(flow,subject_hash,window_started_at,request_count) VALUES('password_reset',$1,now(),1) ON CONFLICT(flow,subject_hash) DO UPDATE SET request_count=CASE WHEN auth_request_limits.window_started_at < now()-interval '1 hour' THEN 1 ELSE auth_request_limits.request_count+1 END,window_started_at=CASE WHEN auth_request_limits.window_started_at < now()-interval '1 hour' THEN now() ELSE auth_request_limits.window_started_at END RETURNING request_count <= 5")
        .bind(email_key).fetch_one(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    if !allowed {
        return Ok((
            StatusCode::ACCEPTED,
            Json(
                json!({"message":"If an eligible account exists for that address, password reset instructions will be sent."}),
            ),
        ));
    }
    let user:Option<Uuid>=sqlx::query_scalar("SELECT id FROM users WHERE lower(email)=$1 AND email_verified AND password_hash IS NOT NULL AND deleted_at IS NULL")
        .bind(&email).fetch_optional(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    if let Some(user_id) = user {
        let token = random_secret();
        let mut tx = state
            .pool
            .begin()
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
        sqlx::query("INSERT INTO auth_flow_states(state_hash,flow,user_id,email,expires_at) VALUES($1,'password_reset',$2,$3,now()+interval '30 minutes')")
            .bind(hash_secret(&token)).bind(user_id).bind(&email).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        let url = format!(
            "{}/reset-password?token={token}",
            state.config.app_base_url.trim_end_matches('/')
        );
        sqlx::query("INSERT INTO email_outbox(recipient,template_key,subject,payload,idempotency_key) VALUES($1,'password_reset','Reset your AnswerScope password',$2,$3)")
            .bind(&email).bind(json!({"reset_url":url})).bind(format!("password-reset:{user_id}:{token}")).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        tx.commit()
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    }
    Ok((
        StatusCode::ACCEPTED,
        Json(
            json!({"message":"If an eligible account exists for that address, password reset instructions will be sent."}),
        ),
    ))
}

async fn complete_password_reset(
    State(state): State<Arc<AppState>>,
    Json(input): Json<PasswordResetCompleteInput>,
) -> Result<Response, ApiError> {
    if input.token.is_empty()
        || input.token.len() > 128
        || input.password.chars().count() < 12
        || input.password.chars().count() > 256
    {
        return Err(ApiError::Validation(
            "The reset token or new password is invalid.".into(),
        ));
    }
    let password_hash = bcrypt::hash(input.password, bcrypt::DEFAULT_COST)
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e.to_string())))?;
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let user:Option<Uuid>=sqlx::query_scalar("UPDATE auth_flow_states SET consumed_at=now() WHERE state_hash=$1 AND flow='password_reset' AND consumed_at IS NULL AND expires_at>now() RETURNING user_id")
        .bind(hash_secret(&input.token)).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    let user = user.ok_or(ApiError::Unauthorized)?;
    sqlx::query(
        "UPDATE users SET password_hash=$2 WHERE id=$1 AND email_verified AND deleted_at IS NULL",
    )
    .bind(user)
    .bind(password_hash)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    sqlx::query("UPDATE auth_flow_states SET consumed_at=now() WHERE user_id=$1 AND flow='password_reset' AND consumed_at IS NULL")
        .bind(user).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    sqlx::query("UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL")
        .bind(user)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let (session, csrf) = issue_session(&state.pool, user, "local", None).await?;
    let mut response = Json(json!({"authenticated":true,"password_changed":true,"session_token":session,"csrf_token":csrf})).into_response();
    set_session_cookies(
        &mut response,
        &session,
        &csrf,
        state.config.auth_cookie_secure,
    );
    Ok(response)
}

async fn ensure_personal_organization(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
) -> Result<(), ApiError> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id=$1)")
            .bind(user_id)
            .fetch_one(&mut **tx)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    if !exists {
        let (email, name): (String, Option<String>) =
            sqlx::query_as("SELECT email,display_name FROM users WHERE id=$1")
                .bind(user_id)
                .fetch_one(&mut **tx)
                .await
                .map_err(|e| ApiError::Internal(e.into()))?;
        let org: Uuid =
            sqlx::query_scalar("INSERT INTO organizations(name) VALUES($1) RETURNING id")
                .bind(format!(
                    "{}'s workspace",
                    name.filter(|v| !v.trim().is_empty())
                        .unwrap_or_else(|| email.split('@').next().unwrap_or("User").to_string())
                ))
                .fetch_one(&mut **tx)
                .await
                .map_err(|e| ApiError::Internal(e.into()))?;
        sqlx::query("INSERT INTO memberships(organization_id,user_id,role) VALUES($1,$2,'owner')")
            .bind(org)
            .bind(user_id)
            .execute(&mut **tx)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
        sqlx::query("INSERT INTO workspaces(organization_id,name) VALUES($1,'Default workspace')")
            .bind(org)
            .execute(&mut **tx)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    }
    Ok(())
}

async fn logout(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    if headers.get(header::COOKIE).is_some() {
        require_csrf(&state.pool, &headers).await?;
    }
    if let Ok(token) = session_token(&headers) {
        let session_id:Option<String>=sqlx::query_scalar("UPDATE sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL RETURNING provider_session_id").bind(hash_secret(&token)).fetch_optional(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.flatten();
        if let (Some(workos_session), Some(api_key)) =
            (session_id, state.config.workos_api_key.as_deref())
        {
            let revoked = reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .ok()
                .map(|client| {
                    client
                        .post("https://api.workos.com/user_management/sessions/revoke")
                        .bearer_auth(api_key)
                        .json(&json!({"session_id":workos_session}))
                        .send()
                });
            if let Some(revoked) = revoked {
                if let Err(error) = revoked.await {
                    tracing::warn!(%error,"WorkOS session revocation failed; local AnswerScope session is revoked");
                }
            }
        }
    }
    let mut response = StatusCode::NO_CONTENT.into_response();
    clear_session_cookies(&mut response, state.config.auth_cookie_secure);
    Ok(response)
}

async fn me(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let user_id = session_user(&state.pool, &headers).await?;
    let user:Value=sqlx::query_scalar("SELECT jsonb_build_object('id',id,'email',email,'display_name',display_name,'email_verified',email_verified,'created_at',created_at) FROM users WHERE id=$1").bind(user_id).fetch_one(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    let memberships:Vec<MembershipView>=sqlx::query_as("SELECT m.organization_id,o.name AS organization_name,m.role::text AS role FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=$1 ORDER BY o.name").bind(user_id).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    Ok(Json(json!({"user":user,"organizations":memberships})))
}

async fn provider_status(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({
        "local_password": true,
        "workos_authkit": state.config.workos_client_id.is_some() && state.config.workos_api_key.is_some(),
        "email_delivery": state.config.resend_api_key.is_some(),
    }))
}

async fn workos_start(
    State(state): State<Arc<AppState>>,
    Query(query): Query<WorkosStartQuery>,
) -> Result<Redirect, ApiError> {
    let client = state
        .config
        .workos_client_id
        .as_deref()
        .ok_or_else(|| ApiError::Validation("WorkOS AuthKit is not configured.".into()))?;
    state
        .config
        .workos_api_key
        .as_deref()
        .ok_or_else(|| ApiError::Validation("WorkOS AuthKit is not configured.".into()))?;
    let secret = random_secret();
    let state_payload = serde_json::json!({
        "secret": secret,
        "next": query.next,
    });
    let state_value = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(serde_json::to_vec(&state_payload).map_err(|e| ApiError::Internal(e.into()))?);
    sqlx::query("INSERT INTO auth_flow_states(state_hash,flow,expires_at) VALUES($1,'workos_login',now()+interval '10 minutes')").bind(hash_secret(&secret)).execute(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    let mut url = url::Url::parse("https://api.workos.com/user_management/authorize")
        .map_err(|e| ApiError::Internal(e.into()))?;
    url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", client)
        .append_pair("redirect_uri", &state.config.workos_redirect_uri)
        .append_pair("provider", "authkit")
        .append_pair("state", &state_value);
    if matches!(query.screen_hint.as_deref(), Some("sign-up")) {
        url.query_pairs_mut().append_pair("screen_hint", "sign-up");
    }
    Ok(Redirect::temporary(url.as_str()))
}

#[derive(Deserialize)]
struct WorkosUser {
    id: String,
    email: String,
    email_verified: bool,
    first_name: Option<String>,
    last_name: Option<String>,
}
#[derive(Deserialize)]
struct WorkosAuthResponse {
    user: WorkosUser,
    access_token: String,
    refresh_token: Option<String>,
}
async fn workos_callback(
    State(state): State<Arc<AppState>>,
    Query(query): Query<WorkosCallbackQuery>,
) -> Result<Response, ApiError> {
    if query.error.is_some() {
        return Err(ApiError::Unauthorized);
    }
    let code = query
        .code
        .filter(|v| !v.is_empty() && v.len() < 2048)
        .ok_or(ApiError::Unauthorized)?;
    let state_value = query
        .state
        .as_ref()
        .filter(|v| !v.is_empty() && v.len() < 256)
        .ok_or(ApiError::Unauthorized)?;
    let state_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(&state_value)
        .map_err(|_| ApiError::Unauthorized)?;
    let state_payload: serde_json::Value = serde_json::from_slice(&state_bytes)
        .map_err(|_| ApiError::Unauthorized)?;
    let state_secret = state_payload
        .get("secret")
        .and_then(|v| v.as_str())
        .ok_or(ApiError::Unauthorized)?;
    let redirect_to = state_payload
        .get("next")
        .and_then(|v| v.as_str())
        .map(String::from);
    let client = state
        .config
        .workos_client_id
        .as_deref()
        .ok_or(ApiError::Unauthorized)?;
    let api_key = state
        .config
        .workos_api_key
        .as_deref()
        .ok_or(ApiError::Unauthorized)?;
    let valid:bool=sqlx::query_scalar("UPDATE auth_flow_states SET consumed_at=now() WHERE state_hash=$1 AND flow='workos_login' AND consumed_at IS NULL AND expires_at>now() RETURNING TRUE").bind(hash_secret(state_secret)).fetch_optional(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.unwrap_or(false);
    if !valid {
        return Err(ApiError::Unauthorized);
    }
    let response=reqwest::Client::builder().timeout(Duration::from_secs(10)).build().map_err(|e|ApiError::Internal(e.into()))?.post("https://api.workos.com/user_management/authenticate").json(&json!({"client_id":client,"client_secret":api_key,"grant_type":"authorization_code","code":code,"redirect_uri":state.config.workos_redirect_uri})).send().await.map_err(|e|ApiError::Internal(e.into()))?;
    if !response.status().is_success() {
        return Err(ApiError::Unauthorized);
    }
    let auth: WorkosAuthResponse = response
        .json()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    if !auth.user.email_verified {
        return Err(ApiError::Unauthorized);
    }
    let email = normalized_email(&auth.user.email)?;
    let display = [
        auth.user.first_name.as_deref(),
        auth.user.last_name.as_deref(),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join(" ");
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let user_id: Option<Uuid> = sqlx::query_scalar("SELECT id FROM users WHERE workos_user_id=$1")
        .bind(&auth.user.id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let user_id = if let Some(id) = user_id {
        id
    } else {
        let existing:Option<Uuid>=sqlx::query_scalar("SELECT id FROM users WHERE lower(email)=$1 AND email_verified AND deleted_at IS NULL FOR UPDATE").bind(&email).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        if let Some(id) = existing {
            sqlx::query("UPDATE users SET workos_user_id=$2,email_verified=TRUE,display_name=COALESCE(NULLIF(display_name,''),$3),last_login_at=now() WHERE id=$1").bind(id).bind(&auth.user.id).bind(&display).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
            id
        } else {
            sqlx::query_scalar("INSERT INTO users(email,display_name,workos_user_id,email_verified,last_login_at) VALUES($1,$2,$3,TRUE,now()) RETURNING id").bind(&email).bind(if display.is_empty(){None}else{Some(display)}).bind(&auth.user.id).fetch_one(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?
        }
    };
    ensure_personal_organization(&mut tx, user_id).await?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let session_id = auth.access_token.split('.').nth(1).and_then(|payload| {
        let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(payload)
            .ok()?;
        let value: Value = serde_json::from_slice(&decoded).ok()?;
        value.get("sid").and_then(Value::as_str).map(str::to_owned)
    });
    let (token, csrf) =
        issue_session(&state.pool, user_id, "workos", session_id.as_deref()).await?;
    // WorkOS refresh credentials are deliberately not retained until encrypted secret storage is configured.
    let _ = auth.refresh_token;
    let user: Value = sqlx::query_scalar("SELECT jsonb_build_object('id', id, 'email', email, 'display_name', display_name) FROM users WHERE id=$1")
        .bind(user_id).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;

    // When a redirect target is provided (frontend-initiated flow), send the session
    // token there so the frontend can set its own cookie. Otherwise return JSON and
    // set cookies on the backend domain as before.
    if let Some(redirect_to) = &redirect_to {
        let mut url = url::Url::parse(redirect_to)
            .map_err(|e| ApiError::Internal(e.into()))?;
        url.query_pairs_mut()
            .append_pair("session_token", &token)
            .append_pair("next", &query.state.clone().unwrap_or_default());
        return Ok(Redirect::temporary(url.as_str()).into_response());
    }

    let mut response = (StatusCode::OK, Json(json!({
        "authenticated": true,
        "session_token": token,
        "csrf_token": csrf,
        "user": user
    }))).into_response();
    set_session_cookies(
        &mut response,
        &token,
        &csrf,
        state.config.auth_cookie_secure,
    );
    Ok(response)
}

async fn list_organizations(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<MembershipView>>, ApiError> {
    let user = session_user(&state.pool, &headers).await?;
    let rows=sqlx::query_as("SELECT m.organization_id,o.name AS organization_name,m.role::text AS role FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=$1 ORDER BY o.name").bind(user).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    Ok(Json(rows))
}
async fn create_organization(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateOrganizationInput>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    require_csrf(&state.pool, &headers).await?;
    let user = session_user(&state.pool, &headers).await?;
    let name = input.name.trim();
    if name.is_empty() || name.len() > 120 {
        return Err(ApiError::Validation(
            "Organization name must contain 1 to 120 characters.".into(),
        ));
    }
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let id: Uuid = sqlx::query_scalar("INSERT INTO organizations(name) VALUES($1) RETURNING id")
        .bind(name)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    sqlx::query("INSERT INTO memberships(organization_id,user_id,role) VALUES($1,$2,'owner')")
        .bind(id)
        .bind(user)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    sqlx::query("INSERT INTO workspaces(organization_id,name) VALUES($1,'Default workspace')")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok((
        StatusCode::CREATED,
        Json(json!({"organization_id":id,"name":name,"role":"owner"})),
    ))
}

async fn org_role(
    pool: &PgPool,
    headers: &HeaderMap,
    org: Uuid,
) -> Result<(Uuid, String), ApiError> {
    let user = session_user(pool, headers).await?;
    let role: Option<String> = sqlx::query_scalar(
        "SELECT role::text FROM memberships WHERE organization_id=$1 AND user_id=$2",
    )
    .bind(org)
    .bind(user)
    .fetch_optional(pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    Ok((user, role.ok_or(ApiError::NotFound)?))
}
async fn list_members(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    axum::extract::Path(org): axum::extract::Path<Uuid>,
) -> Result<Json<Vec<Value>>, ApiError> {
    org_role(&state.pool, &headers, org).await?;
    let rows=sqlx::query("SELECT u.id,u.email,u.display_name,u.email_verified,m.role::text,m.created_at FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND u.deleted_at IS NULL ORDER BY m.created_at").bind(org).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    use sqlx::Row;
    Ok(Json(rows.into_iter().map(|r|json!({"user_id":r.get::<Uuid,_>("id"),"email":r.get::<String,_>("email"),"display_name":r.get::<Option<String>,_>("display_name"),"email_verified":r.get::<bool,_>("email_verified"),"role":r.get::<String,_>("role"),"joined_at":r.get::<DateTime<Utc>,_>("created_at")})).collect()))
}
async fn update_member_role(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    axum::extract::Path((org, target)): axum::extract::Path<(Uuid, Uuid)>,
    Json(input): Json<UpdateRoleInput>,
) -> Result<StatusCode, ApiError> {
    require_csrf(&state.pool, &headers).await?;
    if !matches!(
        input.role.as_str(),
        "owner" | "admin" | "analyst" | "viewer"
    ) {
        return Err(ApiError::Validation(
            "Role must be owner, admin, analyst, or viewer.".into(),
        ));
    }
    let actor = session_user(&state.pool, &headers).await?;
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    sqlx::query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE")
        .bind(org)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or(ApiError::NotFound)?;
    let role: Option<String> = sqlx::query_scalar(
        "SELECT role::text FROM memberships WHERE organization_id=$1 AND user_id=$2",
    )
    .bind(org)
    .bind(actor)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    let role = role.ok_or(ApiError::NotFound)?;
    if !matches!(role.as_str(), "owner" | "admin") {
        return Err(ApiError::Unauthorized);
    }
    let target_role: Option<String> = sqlx::query_scalar(
        "SELECT role::text FROM memberships WHERE organization_id=$1 AND user_id=$2 FOR UPDATE",
    )
    .bind(org)
    .bind(target)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    let target_role = target_role.ok_or(ApiError::NotFound)?;
    if (input.role == "owner" || target_role == "owner") && role != "owner" {
        return Err(ApiError::Unauthorized);
    }
    if target == actor && input.role != "owner" {
        return Err(ApiError::Validation(
            "Owners cannot remove their own owner role.".into(),
        ));
    }
    if target_role == "owner" && input.role != "owner" {
        let owners: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM memberships WHERE organization_id=$1 AND role='owner'",
        )
        .bind(org)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
        if owners <= 1 {
            return Err(ApiError::Validation(
                "An organization must retain at least one owner.".into(),
            ));
        }
    }
    sqlx::query(
        "UPDATE memberships SET role=$3::membership_role WHERE organization_id=$1 AND user_id=$2",
    )
    .bind(org)
    .bind(target)
    .bind(&input.role)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    sqlx::query("INSERT INTO notifications(user_id,organization_id,notification_type,title,body) VALUES($1,$2,'membership.role_changed','Your organization role changed',$3)").bind(target).bind(org).bind(format!("Your role is now {}.",input.role)).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(StatusCode::NO_CONTENT)
}

async fn create_invitation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    axum::extract::Path(org): axum::extract::Path<Uuid>,
    Json(input): Json<InviteInput>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    require_csrf(&state.pool, &headers).await?;
    let actor = session_user(&state.pool, &headers).await?;
    let email = normalized_email(&input.email)?;
    if !matches!(
        input.role.as_str(),
        "admin" | "analyst" | "viewer" | "owner"
    ) {
        return Err(ApiError::Validation(
            "Role must be owner, admin, analyst, or viewer.".into(),
        ));
    }
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    sqlx::query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE")
        .bind(org)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or(ApiError::NotFound)?;
    let actor_role: Option<String> = sqlx::query_scalar(
        "SELECT role::text FROM memberships WHERE organization_id=$1 AND user_id=$2",
    )
    .bind(org)
    .bind(actor)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    let actor_role = actor_role.ok_or(ApiError::NotFound)?;
    if !matches!(actor_role.as_str(), "owner" | "admin")
        || (input.role == "owner" && actor_role != "owner")
    {
        return Err(ApiError::Unauthorized);
    }
    let token = random_secret();
    let existing: Option<(Uuid, DateTime<Utc>)> = sqlx::query_as(
        "SELECT id,expires_at FROM organization_invitations WHERE organization_id=$1 AND lower(email)=$2 AND accepted_at IS NULL AND revoked_at IS NULL FOR UPDATE",
    )
    .bind(org).bind(&email).fetch_optional(&mut *tx).await.map_err(|e| ApiError::Internal(e.into()))?;
    let id = if let Some((id, expires_at)) = existing {
        if expires_at > Utc::now() {
            return Err(ApiError::Validation(
                "An active invitation already exists for this email.".into(),
            ));
        }
        sqlx::query("UPDATE organization_invitations SET role=$2::membership_role,token_hash=$3,invited_by=$4,expires_at=now()+interval '7 days',created_at=now() WHERE id=$1")
            .bind(id).bind(&input.role).bind(hash_secret(&token)).bind(actor).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        id
    } else {
        sqlx::query_scalar("INSERT INTO organization_invitations(organization_id,email,role,token_hash,invited_by,expires_at) VALUES($1,$2,$3::membership_role,$4,$5,now()+interval '7 days') RETURNING id")
            .bind(org).bind(&email).bind(&input.role).bind(hash_secret(&token)).bind(actor).fetch_one(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?
    };
    let organization: String = sqlx::query_scalar("SELECT name FROM organizations WHERE id=$1")
        .bind(org)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let invitation_url = format!(
        "{}/accept-invitation?token={token}",
        state.config.app_base_url.trim_end_matches('/')
    );
    sqlx::query("INSERT INTO email_outbox(recipient,template_key,subject,payload,idempotency_key) VALUES($1,'organization_invitation','You have been invited to AnswerScope',$2,$3)")
        .bind(&email).bind(json!({"organization_name":organization,"role":input.role,"invitation_url":invitation_url})).bind(format!("invitation:{id}:{}",hash_secret(&token)))
        .execute(&mut *tx).await.map_err(|e| ApiError::Internal(e.into()))?;
    let invited_user: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM users WHERE lower(email)=$1 AND deleted_at IS NULL")
            .bind(&email)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    if let Some(user) = invited_user {
        sqlx::query("INSERT INTO notifications(user_id,organization_id,notification_type,title,body,action_url) VALUES($1,$2,'organization.invitation','Organization invitation',$3,$4)")
            .bind(user).bind(org).bind(format!("You were invited to join {organization} as {}.",input.role)).bind(format!("/accept-invitation?token={token}"))
            .execute(&mut *tx).await.map_err(|e| ApiError::Internal(e.into()))?;
    }
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok((
        StatusCode::CREATED,
        Json(json!({"invitation_id":id,"email":email,"role":input.role,"expires_in_days":7})),
    ))
}

async fn invitation_preview(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(token): axum::extract::Path<String>,
) -> Result<Json<Value>, ApiError> {
    if token.len() > 128 {
        return Err(ApiError::NotFound);
    }
    let row: Option<(String, String, DateTime<Utc>)> = sqlx::query_as(
        "SELECT o.name,i.role::text,i.expires_at FROM organization_invitations i JOIN organizations o ON o.id=i.organization_id WHERE i.token_hash=$1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now()",
    )
    .bind(hash_secret(&token)).fetch_optional(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let (organization, role, expires_at) = row.ok_or(ApiError::NotFound)?;
    Ok(Json(
        json!({"organization":organization,"role":role,"expires_at":expires_at}),
    ))
}

async fn accept_invitation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<AcceptInviteInput>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    require_csrf(&state.pool, &headers).await?;
    if input.token.len() > 128 {
        return Err(ApiError::NotFound);
    }
    let user = session_user(&state.pool, &headers).await?;
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let row: Option<(Uuid, Uuid, String, String)> = sqlx::query_as(
        "SELECT i.id,i.organization_id,i.email,i.role::text FROM organization_invitations i WHERE i.token_hash=$1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() FOR UPDATE",
    )
    .bind(hash_secret(&input.token)).fetch_optional(&mut *tx).await.map_err(|e| ApiError::Internal(e.into()))?;
    let (invite_id, org, email, role) = row.ok_or(ApiError::NotFound)?;
    let user_email: String = sqlx::query_scalar(
        "SELECT lower(email) FROM users WHERE id=$1 AND email_verified AND deleted_at IS NULL",
    )
    .bind(user)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?
    .ok_or(ApiError::Unauthorized)?;
    if user_email != email {
        return Err(ApiError::Unauthorized);
    }
    sqlx::query("INSERT INTO memberships(organization_id,user_id,role) VALUES($1,$2,$3::membership_role) ON CONFLICT(organization_id,user_id) DO UPDATE SET role=EXCLUDED.role")
        .bind(org).bind(user).bind(&role).execute(&mut *tx).await.map_err(|e| ApiError::Internal(e.into()))?;
    sqlx::query("UPDATE organization_invitations SET accepted_at=now() WHERE id=$1")
        .bind(invite_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let organization: String = sqlx::query_scalar("SELECT name FROM organizations WHERE id=$1")
        .bind(org)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    sqlx::query("INSERT INTO notifications(user_id,organization_id,notification_type,title,body) VALUES($1,$2,'organization.joined','Joined organization',$3)")
        .bind(user).bind(org).bind(format!("You joined {organization} as {role}."))
        .execute(&mut *tx).await.map_err(|e| ApiError::Internal(e.into()))?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok((
        StatusCode::OK,
        Json(json!({"organization_id":org,"organization":organization,"role":role})),
    ))
}
