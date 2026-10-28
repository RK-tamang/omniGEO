use std::sync::Arc;

use answerscope_billing::{
    InvoiceDraft, InvoiceLine, ManualInvoiceGateway, PaymentGateway, SubscriptionStatus,
    calculate_invoice, validate_transition,
};
use axum::{
    Json, Router,
    body::Bytes,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
};
use chrono::{DateTime, Duration, Utc};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::{error::ApiError, state::AppState};

type HmacSha256 = Hmac<Sha256>;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/v1/billing/plans", get(plans))
        .route("/api/v1/billing/subscription", get(subscription))
        .route("/api/v1/billing/checkout", post(checkout))
        .route("/api/v1/billing/change-plan", post(change_plan))
        .route("/api/v1/billing/cancel", post(cancel))
        .route("/api/v1/billing/reactivate", post(reactivate))
        .route("/api/v1/billing/invoices", get(invoices))
        .route("/api/v1/billing/credits", get(credits))
        .route("/api/v1/billing/refunds", get(refunds).post(request_refund))
        .route("/api/v1/billing/webhooks/{provider}", post(webhook))
}

/// Advances due manual-invoice subscriptions. Workers re-lock and recheck each
/// subscription in a transaction, and renewal invoices use a period-based key.
pub async fn process_due(pool: &PgPool) -> Result<(), ApiError> {
    let due = sqlx::query(
        "SELECT s.id,s.organization_id,s.status,s.plan_version_id,s.plan_price_id,s.billing_mode,s.current_period_start,s.current_period_end,s.cancel_at_period_end,s.custom_price_minor,s.custom_currency::text,p.plan_key,pp.amount_minor,pp.currency::text,pp.billing_interval FROM subscriptions s JOIN plan_versions pv ON pv.id=s.plan_version_id JOIN plans p ON p.id=pv.plan_id LEFT JOIN plan_prices pp ON pp.id=s.plan_price_id WHERE s.is_current AND s.current_period_end<=now() AND (s.status='active' OR (s.status IN ('past_due','grace_period') AND s.grace_period_ends_at<=now())) AND p.plan_key<>'free' ORDER BY s.current_period_end LIMIT 50",
    );
    let rows = due
        .fetch_all(pool)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    for row in rows {
        let mut tx = pool
            .begin()
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
        let id: Uuid = row.get("id");
        // Recheck after acquiring the transaction lock in case another worker advanced it.
        let fresh=sqlx::query("SELECT status,current_period_end,cancel_at_period_end,grace_period_ends_at FROM subscriptions WHERE id=$1 AND is_current FOR UPDATE").bind(id).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        let Some(fresh) = fresh else {
            tx.rollback().await.ok();
            continue;
        };
        let status: String = fresh.get("status");
        let end: Option<DateTime<Utc>> = fresh.get("current_period_end");
        if end.is_none_or(|value| value > Utc::now()) {
            tx.rollback().await.ok();
            continue;
        }
        let org: Uuid = row.get("organization_id");
        let cancel: bool = fresh.get("cancel_at_period_end");
        if cancel {
            transition_update(&mut tx, id, &status, "canceled").await?;
            sqlx::query("UPDATE subscriptions SET is_current=false,canceled_at=now(),ended_at=now(),updated_at=now() WHERE id=$1").bind(id).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
            let (version, price) = free_plan(&mut tx).await?;
            let free_id = create_free_subscription(&mut tx, org, version, price).await?;
            apply_entitlements(&mut tx, org, free_id, version).await?;
            record_event(
                &mut tx,
                org,
                id,
                "canceled_at_period_end",
                Some(&status),
                Some("canceled"),
                "system",
                None,
                json!({}),
                Some(&format!("cancel:{id}")),
            )
            .await?;
            tx.commit()
                .await
                .map_err(|e| ApiError::Internal(e.into()))?;
            continue;
        }
        if matches!(status.as_str(), "past_due" | "grace_period") {
            let grace: Option<DateTime<Utc>> = fresh.get("grace_period_ends_at");
            if grace.is_some_and(|value| value <= Utc::now()) {
                transition_update(&mut tx, id, &status, "expired").await?;
                sqlx::query("UPDATE subscriptions SET is_current=false,ended_at=now(),updated_at=now() WHERE id=$1").bind(id).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
                let (version, price) = free_plan(&mut tx).await?;
                let free_id = create_free_subscription(&mut tx, org, version, price).await?;
                apply_entitlements(&mut tx, org, free_id, version).await?;
                record_event(
                    &mut tx,
                    org,
                    id,
                    "grace_period_expired",
                    Some(&status),
                    Some("expired"),
                    "system",
                    None,
                    json!({}),
                    Some(&format!("expire:{id}")),
                )
                .await?;
                tx.commit()
                    .await
                    .map_err(|e| ApiError::Internal(e.into()))?;
                continue;
            }
            tx.rollback().await.ok();
            continue;
        }
        let old_end = end.unwrap();
        let interval: String = row.get("billing_interval");
        let new_end = period_end(&old_end, &interval)?;
        let amount = row
            .try_get::<Option<i64>, _>("custom_price_minor")
            .ok()
            .flatten()
            .or_else(|| row.try_get::<Option<i64>, _>("amount_minor").ok().flatten())
            .unwrap_or(0);
        let currency = row
            .try_get::<Option<String>, _>("custom_currency")
            .ok()
            .flatten()
            .or_else(|| row.try_get::<Option<String>, _>("currency").ok().flatten())
            .unwrap_or_else(|| "USD".to_owned());
        let plan: String = row.get("plan_key");
        let invoice_id = Uuid::new_v4();
        let inv_no = invoice_number(invoice_id);
        let idem = format!("renewal:{id}:{}", old_end.timestamp());
        let existing: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM invoices WHERE organization_id=$1 AND idempotency_key=$2",
        )
        .bind(org)
        .bind(&idem)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
        if existing.is_none() {
            sqlx::query("INSERT INTO invoices(id,organization_id,subscription_id,invoice_number,invoice_kind,status,currency,subtotal_minor,total_minor,due_at,period_start,period_end,idempotency_key) VALUES($1,$2,$3,$4,'renewal','open',$5,$6,$6,now()+interval '7 days',$7,$8,$9)").bind(invoice_id).bind(org).bind(id).bind(inv_no).bind(&currency).bind(amount).bind(old_end).bind(new_end).bind(&idem).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
            sqlx::query("INSERT INTO invoice_items(invoice_id,description,quantity,unit_amount_minor,amount_minor) VALUES($1,$2,1,$3,$3)").bind(invoice_id).bind(format!("{plan} subscription renewal" )).bind(amount).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        }
        transition_update(&mut tx, id, &status, "past_due").await?;
        sqlx::query("UPDATE subscriptions SET grace_period_ends_at=now()+interval '7 days',updated_at=now() WHERE id=$1").bind(id).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        record_event(
            &mut tx,
            org,
            id,
            "renewal_invoice_created",
            Some(&status),
            Some("past_due"),
            "system",
            None,
            json!({"period_start":old_end,"period_end":new_end,"idempotency_key":idem}),
            Some(&idem),
        )
        .await?;
        tx.commit()
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    }
    Ok(())
}

async fn authorize_org(
    state: &AppState,
    headers: &HeaderMap,
    org: Uuid,
    write: bool,
) -> Result<Uuid, ApiError> {
    let user = crate::auth::session_user(&state.pool, headers).await?;
    if write {
        crate::auth::require_csrf(&state.pool, headers).await?;
    }
    let role: Option<String> = sqlx::query_scalar(
        "SELECT role::text FROM memberships WHERE organization_id=$1 AND user_id=$2",
    )
    .bind(org)
    .bind(user)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    let role = role.ok_or(ApiError::NotFound)?;
    if write && !matches!(role.as_str(), "owner" | "admin") {
        return Err(ApiError::Unauthorized);
    }
    Ok(user)
}

#[derive(Deserialize)]
struct OrgQuery {
    organization_id: Uuid,
}
async fn plans(State(state): State<Arc<AppState>>) -> Result<Json<Value>, ApiError> {
    let rows=sqlx::query("SELECT p.plan_key,p.display_name,p.description,p.custom_pricing,pv.id version_id,pv.version,pv.publication_status,pf.feature_key,pf.feature_value FROM plans p JOIN plan_versions pv ON pv.plan_id=p.id LEFT JOIN plan_features pf ON pf.plan_version_id=pv.id WHERE p.active AND p.is_public ORDER BY CASE p.plan_key WHEN 'free' THEN 0 WHEN 'starter' THEN 1 WHEN 'best_value' THEN 2 ELSE 3 END,pv.version DESC")
        .fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    let mut plans: std::collections::BTreeMap<String, Value> = std::collections::BTreeMap::new();
    for row in rows {
        let key: String = row.get("plan_key");
        let plan=plans.entry(key.clone()).or_insert_with(||json!({"plan_key":key,"name":row.get::<String,_>("display_name"),"description":row.get::<Option<String>,_>("description"),"custom_pricing":row.get::<bool,_>("custom_pricing"),"version_id":row.get::<Uuid,_>("version_id"),"version":row.get::<i32,_>("version"),"publication_status":row.get::<String,_>("publication_status"),"features":{},"prices":[]}));
        if let (Some(feature), Some(value)) = (
            row.try_get::<Option<String>, _>("feature_key")
                .ok()
                .flatten(),
            row.try_get::<Option<Value>, _>("feature_value")
                .ok()
                .flatten(),
        ) {
            plan["features"][feature] = value;
        }
    }
    let price_rows=sqlx::query("SELECT p.plan_key,pp.id,pp.billing_interval,pp.amount_minor,pp.currency::text,pp.trial_days FROM plan_prices pp JOIN plan_versions pv ON pv.id=pp.plan_version_id JOIN plans p ON p.id=pv.plan_id WHERE pp.enabled AND p.is_public AND pv.publication_status='public' AND (pp.valid_until IS NULL OR pp.valid_until>now()) AND pv.effective_at<=now() ORDER BY pp.amount_minor,pp.billing_interval")
        .fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    for row in price_rows {
        let key: String = row.get("plan_key");
        if let Some(plan) = plans.get_mut(&key) {
            plan["prices"].as_array_mut().unwrap().push(json!({"price_id":row.get::<Uuid,_>("id"),"interval":row.get::<String,_>("billing_interval"),"amount_minor":row.get::<i64,_>("amount_minor"),"currency":row.get::<String,_>("currency"),"trial_days":row.get::<i32,_>("trial_days")}));
        }
    }
    Ok(Json(
        json!({"plans":plans.into_values().collect::<Vec<_>>(),"currency_note":"Amounts are integer minor units. Prices only appear after publication review and explicit enablement."}),
    ))
}

async fn subscription(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<OrgQuery>,
) -> Result<Json<Value>, ApiError> {
    authorize_org(&state, &headers, q.organization_id, false).await?;
    let row=sqlx::query("SELECT s.id,s.status,s.billing_mode,s.plan_price_id,s.current_period_start,s.current_period_end,s.trial_ends_at,s.grace_period_ends_at,s.cancel_at_period_end,s.grandfathered,s.custom_price_minor,s.custom_currency::text,p.plan_key,p.display_name,pv.version FROM subscriptions s JOIN plan_versions pv ON pv.id=s.plan_version_id JOIN plans p ON p.id=pv.plan_id WHERE s.organization_id=$1 AND s.is_current")
        .bind(q.organization_id).fetch_optional(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.ok_or(ApiError::NotFound)?;
    let features=sqlx::query("SELECT feature_key,value FROM organization_entitlements WHERE organization_id=$1 ORDER BY feature_key").bind(q.organization_id).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.into_iter().map(|r|json!({"key":r.get::<String,_>("feature_key"),"value":r.get::<Value,_>("value")})).collect::<Vec<_>>();
    let value = json!({"subscription_id":row.get::<Uuid,_>("id"),"status":row.get::<String,_>("status"),"billing_mode":row.get::<String,_>("billing_mode"),"plan_key":row.get::<String,_>("plan_key"),"plan_name":row.get::<String,_>("display_name"),"plan_version":row.get::<i32,_>("version"),"price_id":row.get::<Option<Uuid>,_>("plan_price_id"),"current_period_start":row.get::<Option<DateTime<Utc>>,_>("current_period_start"),"current_period_end":row.get::<Option<DateTime<Utc>>,_>("current_period_end"),"trial_ends_at":row.get::<Option<DateTime<Utc>>,_>("trial_ends_at"),"grace_period_ends_at":row.get::<Option<DateTime<Utc>>,_>("grace_period_ends_at"),"cancel_at_period_end":row.get::<bool,_>("cancel_at_period_end"),"grandfathered":row.get::<bool,_>("grandfathered"),"custom_price_minor":row.get::<Option<i64>,_>("custom_price_minor"),"custom_currency":row.get::<Option<String>,_>("custom_currency"),"effective_entitlements":features});
    Ok(Json(value))
}

#[derive(Deserialize)]
struct CheckoutRequest {
    organization_id: Uuid,
    price_id: Uuid,
    idempotency_key: String,
}
#[derive(Serialize)]
struct CheckoutResponse {
    subscription_id: Uuid,
    invoice_id: Option<Uuid>,
    status: String,
    amount_minor: i64,
    currency: String,
    provider: String,
    payment_instructions: Option<String>,
}
async fn checkout(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CheckoutRequest>,
) -> Result<(StatusCode, Json<CheckoutResponse>), ApiError> {
    authorize_org(&state, &headers, input.organization_id, true).await?;
    if input.idempotency_key.trim().is_empty() || input.idempotency_key.len() > 160 {
        return Err(ApiError::Validation(
            "Idempotency key must contain 1 to 160 characters.".into(),
        ));
    }
    let price:Option<(Uuid,String,i64,String,String,i32)>=sqlx::query_as("SELECT pv.id,p.plan_key,pp.amount_minor,pp.currency::text,pp.billing_interval,pp.trial_days FROM plan_prices pp JOIN plan_versions pv ON pv.id=pp.plan_version_id JOIN plans p ON p.id=pv.plan_id WHERE pp.id=$1 AND pp.enabled AND (pp.valid_until IS NULL OR pp.valid_until>now()) AND p.active AND p.is_public AND pv.publication_status='public' AND pv.effective_at<=now()")
        .bind(input.price_id).fetch_optional(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    let (version_id, plan_key, amount, currency, interval, _trial_days) =
        price.ok_or(ApiError::NotFound)?;
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    sqlx::query("SELECT organization_id FROM billing_accounts WHERE organization_id=$1 FOR UPDATE")
        .bind(input.organization_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or(ApiError::NotFound)?;
    if let Some(existing)=sqlx::query("SELECT i.id,i.subscription_id,s.status,i.total_minor,i.currency::text FROM invoices i JOIN subscriptions s ON s.id=i.subscription_id WHERE i.organization_id=$1 AND i.idempotency_key=$2").bind(input.organization_id).bind(&input.idempotency_key).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?{
        let invoice_id:Uuid=existing.get("id");let sub:Option<Uuid>=existing.get("subscription_id");let status:String=existing.get("status");let total:i64=existing.get("total_minor");let curr:String=existing.get("currency");tx.rollback().await.ok();return Ok((StatusCode::ACCEPTED,Json(CheckoutResponse{subscription_id:sub.ok_or(ApiError::NotFound)?,invoice_id:Some(invoice_id),status,amount_minor:total,currency:curr,provider:"manual_invoice".into(),payment_instructions:Some(state.config.billing_manual_payment_instructions.clone())})))
    }
    let current=sqlx::query("SELECT s.id,s.status,p.plan_key FROM subscriptions s JOIN plan_versions pv ON pv.id=s.plan_version_id JOIN plans p ON p.id=pv.plan_id WHERE s.organization_id=$1 AND s.is_current FOR UPDATE OF s").bind(input.organization_id).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?.ok_or(ApiError::NotFound)?;
    let current_key: String = current.get("plan_key");
    let current_id: Uuid = current.get("id");
    if current_key == plan_key && plan_key == "free" {
        tx.rollback().await.ok();
        return Ok((
            StatusCode::OK,
            Json(CheckoutResponse {
                subscription_id: current_id,
                invoice_id: None,
                status: "active".into(),
                amount_minor: 0,
                currency,
                provider: "none".into(),
                payment_instructions: None,
            }),
        ));
    }
    if current_key != "free" {
        return Err(ApiError::Validation(
            "An active paid subscription exists; use change-plan instead.".into(),
        ));
    }
    let period_start = Utc::now();
    let period_end = period_end(&period_start, &interval)?;
    sqlx::query("UPDATE subscriptions SET is_current=false,updated_at=now() WHERE id=$1")
        .bind(current_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let sub_id = Uuid::new_v4();
    sqlx::query("INSERT INTO subscriptions(id,organization_id,plan_version_id,plan_price_id,status,billing_mode,is_current,current_period_start,current_period_end) VALUES($1,$2,$3,$4,'pending_payment','manual_invoice',true,$5,$6)")
        .bind(sub_id).bind(input.organization_id).bind(version_id).bind(input.price_id).bind(period_start).bind(period_end).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    let draft = InvoiceDraft {
        organization_id: input.organization_id,
        subscription_id: Some(sub_id),
        currency: currency.clone(),
        lines: vec![InvoiceLine {
            description: format!("{plan_key} plan ({interval})"),
            quantity: 1,
            unit_amount_minor: amount,
        }],
        tax_basis_points: 0,
    };
    let totals = calculate_invoice(&draft.lines, &currency, 0)
        .map_err(|e| ApiError::Validation(e.to_string()))?;
    let invoice_id = Uuid::new_v4();
    let number = invoice_number(invoice_id);
    sqlx::query("INSERT INTO invoices(id,organization_id,subscription_id,invoice_number,invoice_kind,status,currency,subtotal_minor,tax_minor,total_minor,due_at,period_start,period_end,idempotency_key) VALUES($1,$2,$3,$4,'checkout','open',$5,$6,$7,$8,now()+make_interval(days=>$9),$10,$11,$12)")
        .bind(invoice_id).bind(input.organization_id).bind(sub_id).bind(number).bind(&currency).bind(totals.subtotal_minor).bind(totals.tax_minor).bind(totals.total_minor).bind(state.config.billing_invoice_due_days as i32).bind(period_start).bind(period_end).bind(&input.idempotency_key).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    sqlx::query("INSERT INTO invoice_items(invoice_id,description,quantity,unit_amount_minor,amount_minor) VALUES($1,$2,1,$3,$3)").bind(invoice_id).bind(format!("{plan_key} plan ({interval})")).bind(amount).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    record_event(
        &mut tx,
        input.organization_id,
        sub_id,
        "checkout_created",
        Some("active"),
        Some("pending_payment"),
        "customer",
        None,
        json!({"invoice_id":invoice_id,"plan_key":plan_key,"price_id":input.price_id}),
        Some(&input.idempotency_key),
    )
    .await?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let gateway = ManualInvoiceGateway {
        instructions: state.config.billing_manual_payment_instructions.clone(),
    };
    let checkout = gateway
        .begin_payment(invoice_id, &draft)
        .await
        .map_err(|e| ApiError::Validation(e.to_string()))?;
    Ok((
        StatusCode::ACCEPTED,
        Json(CheckoutResponse {
            subscription_id: sub_id,
            invoice_id: Some(invoice_id),
            status: "pending_payment".into(),
            amount_minor: totals.total_minor,
            currency,
            provider: checkout.provider_id,
            payment_instructions: checkout.instructions,
        }),
    ))
}

#[derive(Deserialize)]
struct ChangePlanRequest {
    organization_id: Uuid,
    price_id: Uuid,
    idempotency_key: String,
}
async fn change_plan(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<ChangePlanRequest>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let actor = authorize_org(&state, &headers, input.organization_id, true).await?;
    if input.idempotency_key.trim().is_empty() || input.idempotency_key.len() > 160 {
        return Err(ApiError::Validation(
            "Idempotency key must contain 1 to 160 characters.".into(),
        ));
    }
    let target=sqlx::query("SELECT pv.id,p.plan_key,pp.id price_id,pp.amount_minor,pp.currency::text,pp.billing_interval FROM plan_prices pp JOIN plan_versions pv ON pv.id=pp.plan_version_id JOIN plans p ON p.id=pv.plan_id WHERE pp.id=$1 AND pp.enabled AND (pp.valid_until IS NULL OR pp.valid_until>now()) AND p.active AND p.is_public AND pv.publication_status='public' AND pv.effective_at<=now()").bind(input.price_id).fetch_optional(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.ok_or(ApiError::NotFound)?;
    let target_version: Uuid = target.get("id");
    let target_key: String = target.get("plan_key");
    let target_amount: i64 = target.get("amount_minor");
    let target_currency: String = target.get("currency");
    let target_interval: String = target.get("billing_interval");
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let current=sqlx::query("SELECT s.id,s.status,s.plan_version_id,s.plan_price_id,s.current_period_start,s.current_period_end,p.plan_key,pp.amount_minor,pp.currency::text,pp.billing_interval FROM subscriptions s JOIN plan_versions pv ON pv.id=s.plan_version_id JOIN plans p ON p.id=pv.plan_id LEFT JOIN plan_prices pp ON pp.id=s.plan_price_id WHERE s.organization_id=$1 AND s.is_current FOR UPDATE OF s").bind(input.organization_id).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?.ok_or(ApiError::NotFound)?;
    let sub_id: Uuid = current.get("id");
    let current_status: String = current.get("status");
    let current_key: String = current.get("plan_key");
    if current_status != "active" {
        return Err(ApiError::Validation(
            "Plan changes require an active subscription.".into(),
        ));
    }
    if current_key == "free" {
        return Err(ApiError::Validation(
            "Use checkout to move from Free to a paid plan.".into(),
        ));
    }
    let duplicate: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM invoices WHERE organization_id=$1 AND idempotency_key=$2",
    )
    .bind(input.organization_id)
    .bind(&input.idempotency_key)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    if let Some(invoice_id) = duplicate {
        tx.rollback().await.ok();
        return Ok((
            StatusCode::ACCEPTED,
            Json(json!({"invoice_id":invoice_id,"status":"open","deduplicated":true})),
        ));
    }
    if let Some((current_amount, current_currency, current_interval)) = current
        .try_get::<Option<i64>, _>("amount_minor")
        .ok()
        .flatten()
        .zip(
            current
                .try_get::<Option<String>, _>("currency")
                .ok()
                .flatten(),
        )
        .zip(
            current
                .try_get::<Option<String>, _>("billing_interval")
                .ok()
                .flatten(),
        )
        .map(|((a, c), i)| (a, c, i))
    {
        if current_currency != target_currency {
            return Err(ApiError::Validation(
                "Currency changes require a separate checkout.".into(),
            ));
        }
        let current_monthly = monthly_equivalent(current_amount, &current_interval);
        let target_monthly = monthly_equivalent(target_amount, &target_interval);
        if target_key == "free" || target_monthly <= current_monthly {
            sqlx::query("UPDATE subscriptions SET plan_version_id=$2,plan_price_id=$3,billing_mode=CASE WHEN $4='free' THEN 'free' ELSE 'manual_invoice' END,current_period_start=CASE WHEN $4='free' THEN now() ELSE current_period_start END,current_period_end=CASE WHEN $4='free' THEN now()+interval '100 years' ELSE current_period_end END,updated_at=now() WHERE id=$1")
                .bind(sub_id).bind(target_version).bind(input.price_id).bind(&target_key).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
            apply_entitlements(&mut tx, input.organization_id, sub_id, target_version).await?;
            record_event(
                &mut tx,
                input.organization_id,
                sub_id,
                "plan_downgraded",
                Some("active"),
                Some("active"),
                "customer",
                Some(actor),
                json!({"target_plan":target_key,"policy":"immediate_no_proration_or_refund"}),
                Some(&input.idempotency_key),
            )
            .await?;
            tx.commit()
                .await
                .map_err(|e| ApiError::Internal(e.into()))?;
            return Ok((
                StatusCode::OK,
                Json(
                    json!({"subscription_id":sub_id,"status":"active","plan_key":target_key,"effective":"immediate","refund":false}),
                ),
            ));
        }
        let period_start: Option<DateTime<Utc>> = current.get("current_period_start");
        let period_end: Option<DateTime<Utc>> = current.get("current_period_end");
        let start = period_start.ok_or_else(|| {
            ApiError::Validation("Current subscription period is not defined.".into())
        })?;
        let end = period_end.ok_or_else(|| {
            ApiError::Validation("Current subscription period is not defined.".into())
        })?;
        let total = (end - start).num_seconds().max(1) as i128;
        let remaining = (end - Utc::now()).num_seconds().max(0).min(total as i64) as i128;
        let unused = (i128::from(current_amount) * remaining + total / 2) / total;
        let amount = (i128::from(target_amount) - unused).max(0);
        let amount = i64::try_from(amount)
            .map_err(|_| ApiError::Validation("Proration amount overflow.".into()))?;
        if amount == 0 {
            sqlx::query("UPDATE subscriptions SET plan_version_id=$2,plan_price_id=$3,current_period_start=now(),current_period_end=now()+make_interval(months=>$4),updated_at=now() WHERE id=$1").bind(sub_id).bind(target_version).bind(input.price_id).bind(interval_months(&target_interval)).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
            apply_entitlements(&mut tx, input.organization_id, sub_id, target_version).await?;
            tx.commit()
                .await
                .map_err(|e| ApiError::Internal(e.into()))?;
            return Ok((
                StatusCode::OK,
                Json(
                    json!({"subscription_id":sub_id,"status":"active","effective":"immediate","amount_minor":0}),
                ),
            ));
        }
        let invoice_id = Uuid::new_v4();
        let invoice_number = invoice_number(invoice_id);
        let due = Utc::now() + Duration::days(state.config.billing_invoice_due_days);
        sqlx::query("INSERT INTO invoices(id,organization_id,subscription_id,invoice_number,invoice_kind,status,currency,subtotal_minor,total_minor,due_at,pending_plan_version_id,pending_plan_price_id,idempotency_key) VALUES($1,$2,$3,$4,'plan_change','open',$5,$6,$6,$7,$8,$9,$10)")
            .bind(invoice_id).bind(input.organization_id).bind(sub_id).bind(invoice_number).bind(&target_currency).bind(amount).bind(due).bind(target_version).bind(input.price_id).bind(&input.idempotency_key).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        sqlx::query("INSERT INTO invoice_items(invoice_id,description,quantity,unit_amount_minor,amount_minor,metadata) VALUES($1,$2,1,$3,$3,$4)").bind(invoice_id).bind(format!("Prorated upgrade to {target_key}" )).bind(amount).bind(json!({"unused_period_credit_minor":unused,"current_price_minor":current_amount})).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        sqlx::query("INSERT INTO pending_plan_changes(subscription_id,target_plan_version_id,target_plan_price_id,invoice_id,effective_at,mode) VALUES($1,$2,$3,$4,now(),'upgrade_prorated')")
            .bind(sub_id).bind(target_version).bind(input.price_id).bind(invoice_id).execute(&mut *tx).await.map_err(|e|ApiError::Internal(error_to_anyhow(e)))?;
        record_event(&mut tx,input.organization_id,sub_id,"plan_change_requested",Some("active"),Some("active"),"customer",Some(actor),json!({"target_plan":target_key,"invoice_id":invoice_id,"prorated_amount_minor":amount}),Some(&input.idempotency_key)).await?;
        tx.commit()
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
        return Ok((
            StatusCode::ACCEPTED,
            Json(
                json!({"subscription_id":sub_id,"invoice_id":invoice_id,"status":"open","effective":"after_verified_payment","amount_minor":amount,"currency":target_currency}),
            ),
        ));
    }
    Err(ApiError::Validation(
        "Current subscription price is unavailable.".into(),
    ))
}

fn error_to_anyhow(error: sqlx::Error) -> anyhow::Error {
    error.into()
}
fn monthly_equivalent(amount: i64, interval: &str) -> i128 {
    if interval == "annual" {
        i128::from(amount) / 12
    } else {
        i128::from(amount)
    }
}
fn interval_months(interval: &str) -> i32 {
    if interval == "annual" { 12 } else { 1 }
}
fn period_end(start: &DateTime<Utc>, interval: &str) -> Result<DateTime<Utc>, ApiError> {
    Ok(*start + Duration::days(if interval == "annual" { 365 } else { 30 }))
}
fn invoice_number(id: Uuid) -> String {
    format!(
        "AS-{}-{}",
        Utc::now().format("%Y%m%d"),
        id.simple().to_string()[..8].to_ascii_uppercase()
    )
}

async fn cancel(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CancelRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = authorize_org(&state, &headers, input.organization_id, true).await?;
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let row=sqlx::query("SELECT id,status,plan_price_id,plan_version_id,cancel_at_period_end,current_period_end FROM subscriptions WHERE organization_id=$1 AND is_current FOR UPDATE").bind(input.organization_id).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?.ok_or(ApiError::NotFound)?;
    let id: Uuid = row.get("id");
    let status: String = row.get("status");
    let end: Option<DateTime<Utc>> = row.get("current_period_end");
    if status == "active" && input.at_period_end.unwrap_or(true) {
        sqlx::query(
            "UPDATE subscriptions SET cancel_at_period_end=true,updated_at=now() WHERE id=$1",
        )
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
        record_event(
            &mut tx,
            input.organization_id,
            id,
            "cancel_scheduled",
            Some("active"),
            Some("active"),
            "customer",
            Some(actor),
            json!({"effective_at":end}),
            None,
        )
        .await?;
        tx.commit()
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
        return Ok(Json(
            json!({"subscription_id":id,"status":"active","cancel_at_period_end":true,"effective_at":end}),
        ));
    }
    transition_update(&mut tx, id, &status, "canceled").await?;
    sqlx::query("UPDATE subscriptions SET is_current=false,canceled_at=now(),ended_at=now(),updated_at=now() WHERE id=$1").bind(id).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    let free = free_plan(&mut tx).await?;
    let free_sub = create_free_subscription(&mut tx, input.organization_id, free.0, free.1).await?;
    apply_entitlements(&mut tx, input.organization_id, free_sub, free.0).await?;
    record_event(
        &mut tx,
        input.organization_id,
        id,
        "subscription_canceled",
        Some(&status),
        Some("canceled"),
        "customer",
        Some(actor),
        json!({"effective":"immediate"}),
        None,
    )
    .await?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(
        json!({"subscription_id":free_sub,"status":"active","plan_key":"free","canceled_subscription_id":id}),
    ))
}
#[derive(Deserialize)]
struct CancelRequest {
    organization_id: Uuid,
    at_period_end: Option<bool>,
}
async fn reactivate(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<OrgBody>,
) -> Result<Json<Value>, ApiError> {
    let actor = authorize_org(&state, &headers, input.organization_id, true).await?;
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let row=sqlx::query("SELECT id,status,cancel_at_period_end,current_period_end FROM subscriptions WHERE organization_id=$1 AND is_current FOR UPDATE").bind(input.organization_id).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?.ok_or(ApiError::NotFound)?;
    let id: Uuid = row.get("id");
    let status: String = row.get("status");
    let cancel: bool = row.get("cancel_at_period_end");
    let end: Option<DateTime<Utc>> = row.get("current_period_end");
    if !cancel && status == "active" {
        tx.rollback().await.ok();
        return Ok(Json(
            json!({"subscription_id":id,"status":"active","cancel_at_period_end":false,"changed":false}),
        ));
    }
    if status == "canceled" && end.is_some_and(|end| end <= Utc::now()) {
        return Err(ApiError::Validation(
            "The canceled billing period has ended; use checkout to resubscribe.".into(),
        ));
    }
    if status == "canceled" {
        validate_transition(SubscriptionStatus::Canceled, SubscriptionStatus::Active)
            .map_err(|e| ApiError::Validation(e.to_string()))?;
    }
    sqlx::query("UPDATE subscriptions SET status='active',cancel_at_period_end=false,canceled_at=NULL,ended_at=NULL,is_current=true,updated_at=now() WHERE id=$1").bind(id).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    apply_entitlements_for_sub(&mut tx, input.organization_id, id).await?;
    record_event(
        &mut tx,
        input.organization_id,
        id,
        "subscription_reactivated",
        Some(&status),
        Some("active"),
        "customer",
        Some(actor),
        json!({}),
        None,
    )
    .await?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(
        json!({"subscription_id":id,"status":"active","cancel_at_period_end":false,"changed":true}),
    ))
}
#[derive(Deserialize)]
struct OrgBody {
    organization_id: Uuid,
}

async fn invoices(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<OrgQuery>,
) -> Result<Json<Vec<Value>>, ApiError> {
    authorize_org(&state, &headers, q.organization_id, false).await?;
    let rows=sqlx::query("SELECT i.id,i.invoice_number,i.invoice_kind,i.status,i.currency::text,i.subtotal_minor,i.tax_minor,i.total_minor,i.amount_paid_minor,i.due_at,i.period_start,i.period_end,i.created_at,i.paid_at FROM invoices i WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100").bind(q.organization_id).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    Ok(Json(rows.into_iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"invoice_number":r.get::<String,_>("invoice_number"),"kind":r.get::<String,_>("invoice_kind"),"status":r.get::<String,_>("status"),"currency":r.get::<String,_>("currency"),"subtotal_minor":r.get::<i64,_>("subtotal_minor"),"tax_minor":r.get::<i64,_>("tax_minor"),"total_minor":r.get::<i64,_>("total_minor"),"amount_paid_minor":r.get::<i64,_>("amount_paid_minor"),"due_at":r.get::<DateTime<Utc>,_>("due_at"),"period_start":r.get::<Option<DateTime<Utc>>,_>("period_start"),"period_end":r.get::<Option<DateTime<Utc>>,_>("period_end"),"created_at":r.get::<DateTime<Utc>,_>("created_at"),"paid_at":r.get::<Option<DateTime<Utc>>,_>("paid_at")})).collect()))
}
async fn credits(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<OrgQuery>,
) -> Result<Json<Value>, ApiError> {
    authorize_org(&state, &headers, q.organization_id, false).await?;
    let balance: i64 =
        sqlx::query_scalar("SELECT balance_units FROM credit_accounts WHERE organization_id=$1")
            .bind(q.organization_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?
            .unwrap_or(0);
    let rows=sqlx::query("SELECT amount_units,transaction_type,source_id,expires_at,metadata,created_at FROM credit_transactions WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100").bind(q.organization_id).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    Ok(Json(
        json!({"balance_units":balance,"transactions":rows.into_iter().map(|r|json!({"amount_units":r.get::<i64,_>("amount_units"),"type":r.get::<String,_>("transaction_type"),"source_id":r.get::<Option<Uuid>,_>("source_id"),"expires_at":r.get::<Option<DateTime<Utc>>,_>("expires_at"),"metadata":r.get::<Value,_>("metadata"),"created_at":r.get::<DateTime<Utc>,_>("created_at")})).collect::<Vec<_>>()}),
    ))
}

#[derive(Deserialize)]
struct RefundRequest {
    organization_id: Uuid,
    payment_id: Uuid,
    amount_minor: i64,
    reason: String,
}

async fn request_refund(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<RefundRequest>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let actor = authorize_org(&state, &headers, input.organization_id, true).await?;
    let reason = input.reason.trim();
    if input.amount_minor <= 0 || reason.is_empty() || reason.len() > 500 {
        return Err(ApiError::Validation(
            "Refund amount must be positive and reason must contain 1 to 500 characters.".into(),
        ));
    }
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let payment = sqlx::query("SELECT id,invoice_id,status,amount_minor,currency::text FROM payments WHERE id=$1 AND organization_id=$2 FOR UPDATE")
        .bind(input.payment_id)
        .bind(input.organization_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or(ApiError::NotFound)?;
    let payment_status: String = payment.get("status");
    if !matches!(payment_status.as_str(), "succeeded" | "partially_refunded") {
        return Err(ApiError::Validation(
            "Only settled payments can be submitted for refund.".into(),
        ));
    }
    let payment_amount: i64 = payment.get("amount_minor");
    let already_reserved: i64 = sqlx::query_scalar("SELECT COALESCE(sum(amount_minor),0)::bigint FROM refunds WHERE payment_id=$1 AND status IN ('pending','succeeded')")
        .bind(input.payment_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    if input.amount_minor > payment_amount.saturating_sub(already_reserved) {
        return Err(ApiError::Validation(
            "Refund amount exceeds the unrefunded payment balance.".into(),
        ));
    }
    let refund_id = Uuid::new_v4();
    let currency: String = payment.get("currency");
    sqlx::query("INSERT INTO refunds(id,payment_id,amount_minor,currency,reason,status,created_by) VALUES($1,$2,$3,$4,$5,'pending',$6)")
        .bind(refund_id)
        .bind(input.payment_id)
        .bind(input.amount_minor)
        .bind(&currency)
        .bind(reason)
        .bind(actor)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let invoice_id: Uuid = payment.get("invoice_id");
    sqlx::query("INSERT INTO subscription_events(organization_id,subscription_id,event_key,source,actor_user_id,details) SELECT $1,s.id,'refund_requested','customer',$2,jsonb_build_object('refund_id',$3,'payment_id',$4,'amount_minor',$5,'reason',$6) FROM subscriptions s WHERE s.id=(SELECT subscription_id FROM invoices WHERE id=$7) AND s.organization_id=$1")
        .bind(input.organization_id)
        .bind(actor)
        .bind(refund_id)
        .bind(input.payment_id)
        .bind(input.amount_minor)
        .bind(reason)
        .bind(invoice_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok((
        StatusCode::ACCEPTED,
        Json(
            json!({"refund_id":refund_id,"payment_id":input.payment_id,"amount_minor":input.amount_minor,"currency":currency,"status":"pending","message":"Refund request recorded; funds are not marked returned until settlement is verified."}),
        ),
    ))
}

async fn refunds(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<OrgQuery>,
) -> Result<Json<Vec<Value>>, ApiError> {
    authorize_org(&state, &headers, q.organization_id, false).await?;
    let rows = sqlx::query("SELECT r.id,r.payment_id,r.amount_minor,r.currency::text,r.reason,r.status,r.provider_reference,r.created_at FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.organization_id=$1 ORDER BY r.created_at DESC LIMIT 100")
        .bind(q.organization_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(
        rows.into_iter()
            .map(|row| {
                json!({
                    "refund_id":row.get::<Uuid,_>("id"),
                    "payment_id":row.get::<Uuid,_>("payment_id"),
                    "amount_minor":row.get::<i64,_>("amount_minor"),
                    "currency":row.get::<String,_>("currency"),
                    "reason":row.get::<String,_>("reason"),
                    "status":row.get::<String,_>("status"),
                    "provider_reference":row.get::<Option<String>,_>("provider_reference"),
                    "created_at":row.get::<DateTime<Utc>,_>("created_at"),
                })
            })
            .collect(),
    ))
}

#[derive(Deserialize)]
struct ManualEvent {
    event_id: String,
    event_type: String,
    invoice_id: Uuid,
    provider_reference: String,
    amount_minor: i64,
    currency: String,
    occurred_at: DateTime<Utc>,
    reason: Option<String>,
    refund_id: Option<Uuid>,
}
async fn webhook(
    State(state): State<Arc<AppState>>,
    Path(provider): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, ApiError> {
    if provider != "manual_invoice" {
        return Err(ApiError::Validation(
            "This payment provider has no enabled, verified adapter.".into(),
        ));
    }
    let secret = state
        .config
        .billing_manual_settlement_secret
        .as_deref()
        .ok_or_else(|| ApiError::Validation("Manual settlement is not configured.".into()))?;
    let signature = headers
        .get("x-answerscope-signature")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("sha256="))
        .ok_or(ApiError::Unauthorized)?;
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).map_err(|e| ApiError::Internal(e.into()))?;
    mac.update(&body);
    let bytes = hex::decode(signature).map_err(|_| ApiError::Unauthorized)?;
    mac.verify_slice(&bytes)
        .map_err(|_| ApiError::Unauthorized)?;
    let event: ManualEvent = serde_json::from_slice(&body)
        .map_err(|e| ApiError::Validation(format!("Invalid settlement event: {e}")))?;
    if event.event_id.trim().is_empty()
        || event.event_id.len() > 200
        || event.provider_reference.trim().is_empty()
        || event.provider_reference.len() > 200
    {
        return Err(ApiError::Validation(
            "Settlement event id and payment reference are required.".into(),
        ));
    }
    if (Utc::now() - event.occurred_at).num_days().abs() > 30 {
        return Err(ApiError::Validation(
            "Settlement event timestamp is outside the accepted reconciliation window.".into(),
        ));
    }
    process_manual_event(&state.pool, event).await?;
    Ok(Json(json!({"received":true})))
}

async fn process_manual_event(pool: &PgPool, event: ManualEvent) -> Result<(), ApiError> {
    if !matches!(
        event.event_type.as_str(),
        "payment_succeeded" | "payment_failed" | "refund_succeeded" | "refund_failed"
    ) {
        return Err(ApiError::Validation(
            "Unsupported settlement event type.".into(),
        ));
    }
    let digest=Sha256::digest(serde_json::to_vec(&json!({"event_id":event.event_id,"event_type":event.event_type,"invoice_id":event.invoice_id,"refund_id":event.refund_id,"payment_reference":event.provider_reference,"amount_minor":event.amount_minor,"currency":event.currency,"occurred_at":event.occurred_at})).map_err(|e|ApiError::Internal(e.into()))?).iter().map(|b|format!("{b:02x}")).collect::<String>();
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let inserted:Option<Uuid>=sqlx::query_scalar("INSERT INTO payment_webhook_events(provider_id,provider_event_id,event_type,occurred_at,payload,payload_sha256) VALUES('manual_invoice',$1,$2,$3,$4,$5) ON CONFLICT(provider_id,provider_event_id) DO NOTHING RETURNING id")
        .bind(&event.event_id).bind(&event.event_type).bind(event.occurred_at).bind(json!({"invoice_id":event.invoice_id,"refund_id":event.refund_id,"provider_reference":event.provider_reference,"amount_minor":event.amount_minor,"currency":event.currency})).bind(digest).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    let Some(webhook_id) = inserted else {
        tx.rollback().await.ok();
        return Ok(());
    };
    let inv=sqlx::query("SELECT id,organization_id,subscription_id,status,invoice_kind,currency::text,total_minor,period_start,period_end,pending_plan_version_id,pending_plan_price_id,last_payment_event_at FROM invoices WHERE id=$1 FOR UPDATE").bind(event.invoice_id).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?.ok_or(ApiError::NotFound)?;
    let org: Uuid = inv.get("organization_id");
    let sub: Option<Uuid> = inv.get("subscription_id");
    let invoice_status: String = inv.get("status");
    let invoice_kind: String = inv.get("invoice_kind");
    let currency: String = inv.get("currency");
    let total: i64 = inv.get("total_minor");
    if matches!(
        event.event_type.as_str(),
        "refund_succeeded" | "refund_failed"
    ) {
        let refund_id = event.refund_id.ok_or_else(|| {
            ApiError::Validation("Refund settlement must include refund_id.".into())
        })?;
        let refund = sqlx::query("SELECT r.payment_id,r.amount_minor,r.currency::text,r.status,p.amount_minor payment_amount FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE r.id=$1 AND p.invoice_id=$2 AND p.organization_id=$3 FOR UPDATE OF r,p")
            .bind(refund_id)
            .bind(event.invoice_id)
            .bind(org)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?
            .ok_or(ApiError::NotFound)?;
        let refund_status: String = refund.get("status");
        let refund_amount: i64 = refund.get("amount_minor");
        let refund_currency: String = refund.get("currency");
        if event.amount_minor != refund_amount
            || event.currency.to_ascii_uppercase() != refund_currency
        {
            return Err(ApiError::Validation(
                "Refund amount and currency must match the recorded refund request.".into(),
            ));
        }
        if refund_status != "pending" {
            sqlx::query("UPDATE payment_webhook_events SET processing_status='ignored',processed_at=now(),last_error='Refund is already resolved.' WHERE id=$1")
                .bind(webhook_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| ApiError::Internal(e.into()))?;
            tx.commit()
                .await
                .map_err(|e| ApiError::Internal(e.into()))?;
            return Ok(());
        }
        let new_status = if event.event_type == "refund_succeeded" {
            "succeeded"
        } else {
            "failed"
        };
        sqlx::query("UPDATE refunds SET status=$2,provider_reference=$3 WHERE id=$1")
            .bind(refund_id)
            .bind(new_status)
            .bind(&event.provider_reference)
            .execute(&mut *tx)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
        if new_status == "succeeded" {
            let payment_id: Uuid = refund.get("payment_id");
            let refunded: i64 = sqlx::query_scalar("SELECT COALESCE(sum(amount_minor),0)::bigint FROM refunds WHERE payment_id=$1 AND status='succeeded'")
                .bind(payment_id)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| ApiError::Internal(e.into()))?;
            let payment_amount: i64 = refund.get("payment_amount");
            let payment_status = if refunded >= payment_amount {
                "refunded"
            } else {
                "partially_refunded"
            };
            sqlx::query("UPDATE payments SET status=$2 WHERE id=$1")
                .bind(payment_id)
                .bind(payment_status)
                .execute(&mut *tx)
                .await
                .map_err(|e| ApiError::Internal(e.into()))?;
            let fully_refunded: bool = sqlx::query_scalar("SELECT COALESCE(sum(r.amount_minor),0)>=(SELECT COALESCE(sum(amount_minor),0) FROM payments WHERE invoice_id=$1 AND status IN ('succeeded','partially_refunded','refunded')) FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.invoice_id=$1 AND r.status='succeeded'")
                .bind(event.invoice_id)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| ApiError::Internal(e.into()))?;
            if fully_refunded {
                sqlx::query("UPDATE invoices SET status='refunded',updated_at=now() WHERE id=$1")
                    .bind(event.invoice_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| ApiError::Internal(e.into()))?;
            }
        }
        sqlx::query("UPDATE payment_webhook_events SET processing_status='processed',processed_at=now() WHERE id=$1")
            .bind(webhook_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
        tx.commit()
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
        return Ok(());
    }
    if event.currency.to_ascii_uppercase() != currency || event.amount_minor != total {
        return Err(ApiError::Validation(
            "Verified settlement currency and amount must exactly match the invoice.".into(),
        ));
    }
    if invoice_status == "paid" {
        sqlx::query("UPDATE payment_webhook_events SET processing_status='ignored',processed_at=now(),last_error='Invoice already paid.' WHERE id=$1").bind(webhook_id).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        tx.commit()
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
        return Ok(());
    }
    let payment_status = if event.event_type == "payment_succeeded" {
        "succeeded"
    } else if event.event_type == "payment_failed" {
        "failed"
    } else {
        return Err(ApiError::Validation(
            "Refund events require a payment reference and are not yet enabled.".into(),
        ));
    };
    let payment_id = Uuid::new_v4();
    sqlx::query("INSERT INTO payments(id,organization_id,invoice_id,provider_id,provider_reference,status,amount_minor,currency,verified_at,provider_payload) VALUES($1,$2,$3,'manual_invoice',$4,$5,$6,$7,now(),$8) ON CONFLICT(provider_id,provider_reference) DO NOTHING")
        .bind(payment_id).bind(org).bind(event.invoice_id).bind(&event.provider_reference).bind(payment_status).bind(event.amount_minor).bind(&currency).bind(json!({"event_id":event.event_id,"operator_reason":event.reason})).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    let Some(sub_id) = sub else {
        return Err(ApiError::Validation(
            "Invoice is not associated with a subscription.".into(),
        ));
    };
    let subrow=sqlx::query("SELECT status,last_payment_event_at,plan_version_id,plan_price_id,organization_id,is_current FROM subscriptions WHERE id=$1 FOR UPDATE").bind(sub_id).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?.ok_or(ApiError::NotFound)?;
    let sub_status: String = subrow.get("status");
    let last_event: Option<DateTime<Utc>> = inv.get("last_payment_event_at");
    if !subrow.get::<bool, _>("is_current") {
        if event.event_type == "payment_succeeded" {
            sqlx::query("UPDATE invoices SET status='paid',amount_paid_minor=total_minor,paid_at=now(),last_payment_event_at=$2,updated_at=now() WHERE id=$1").bind(event.invoice_id).bind(event.occurred_at).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        }
        sqlx::query("UPDATE payment_webhook_events SET processing_status='ignored',processed_at=now(),last_error='Payment recorded without activation because subscription is no longer current.' WHERE id=$1").bind(webhook_id).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        tx.commit()
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
        return Ok(());
    }
    if last_event.is_some_and(|last| event.occurred_at < last) {
        sqlx::query("UPDATE payment_webhook_events SET processing_status='ignored',processed_at=now(),last_error='Out-of-order event.' WHERE id=$1").bind(webhook_id).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        tx.commit()
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
        return Ok(());
    }
    if event.event_type == "payment_failed" {
        if sub_status == "active" {
            transition_update(&mut tx, sub_id, &sub_status, "past_due").await?;
            sqlx::query("UPDATE subscriptions SET status='past_due',grace_period_ends_at=now()+interval '7 days',last_payment_event_at=$2,updated_at=now() WHERE id=$1").bind(sub_id).bind(event.occurred_at).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        }
        sqlx::query("UPDATE invoices SET status='overdue',last_payment_event_at=$2,updated_at=now() WHERE id=$1").bind(event.invoice_id).bind(event.occurred_at).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        record_event(
            &mut tx,
            org,
            sub_id,
            "payment_failed",
            Some(&sub_status),
            Some("past_due"),
            "manual_invoice",
            None,
            json!({"invoice_id":event.invoice_id,"provider_reference":event.provider_reference}),
            Some(&event.event_id),
        )
        .await?;
    } else {
        if matches!(
            invoice_kind.as_str(),
            "checkout" | "renewal" | "plan_change"
        ) {
            if invoice_kind == "checkout" {
                validate_transition(
                    SubscriptionStatus::PendingPayment,
                    SubscriptionStatus::Active,
                )
                .map_err(|e| ApiError::Validation(e.to_string()))?;
                let price_id: Option<Uuid> =
                    sqlx::query_scalar("SELECT plan_price_id FROM subscriptions WHERE id=$1")
                        .bind(sub_id)
                        .fetch_one(&mut *tx)
                        .await
                        .map_err(|e| ApiError::Internal(e.into()))?;
                let (version, interval) = plan_interval(&mut tx, price_id).await?;
                let period_start = Utc::now();
                let period_end = period_end(&period_start, &interval)?;
                sqlx::query("UPDATE subscriptions SET status='active',current_period_start=$2,current_period_end=$3,last_payment_event_at=$4,updated_at=now() WHERE id=$1").bind(sub_id).bind(period_start).bind(period_end).bind(event.occurred_at).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
                apply_entitlements(&mut tx, org, sub_id, version).await?;
                grant_included_credits(&mut tx, org, sub_id, version, period_end).await?;
            } else if invoice_kind == "renewal" {
                let start: Option<DateTime<Utc>> = inv.get("period_start");
                let end: Option<DateTime<Utc>> = inv.get("period_end");
                let start = start.unwrap_or_else(Utc::now);
                let end = end.unwrap_or(start + Duration::days(30));
                validate_transition(parse_status(&sub_status)?, SubscriptionStatus::Active)
                    .map_err(|e| ApiError::Validation(e.to_string()))?;
                sqlx::query("UPDATE subscriptions SET status='active',current_period_start=$2,current_period_end=$3,grace_period_ends_at=NULL,last_payment_event_at=$4,updated_at=now() WHERE id=$1").bind(sub_id).bind(start).bind(end).bind(event.occurred_at).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
                let version: Uuid =
                    sqlx::query_scalar("SELECT plan_version_id FROM subscriptions WHERE id=$1")
                        .bind(sub_id)
                        .fetch_one(&mut *tx)
                        .await
                        .map_err(|e| ApiError::Internal(e.into()))?;
                apply_entitlements(&mut tx, org, sub_id, version).await?;
                grant_included_credits(&mut tx, org, sub_id, version, end).await?;
            } else {
                let change=sqlx::query("SELECT target_plan_version_id,target_plan_price_id FROM pending_plan_changes WHERE invoice_id=$1 AND status='pending' FOR UPDATE").bind(event.invoice_id).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?.ok_or(ApiError::NotFound)?;
                let version: Uuid = change.get("target_plan_version_id");
                let price: Uuid = change.get("target_plan_price_id");
                let (_, interval) = plan_interval(&mut tx, Some(price)).await?;
                let start = Utc::now();
                let end = period_end(&start, &interval)?;
                sqlx::query("UPDATE subscriptions SET status='active',plan_version_id=$2,plan_price_id=$3,current_period_start=$4,current_period_end=$5,last_payment_event_at=$6,updated_at=now() WHERE id=$1").bind(sub_id).bind(version).bind(price).bind(start).bind(end).bind(event.occurred_at).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
                sqlx::query("UPDATE pending_plan_changes SET status='applied' WHERE invoice_id=$1")
                    .bind(event.invoice_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| ApiError::Internal(e.into()))?;
                apply_entitlements(&mut tx, org, sub_id, version).await?;
                grant_included_credits(&mut tx, org, sub_id, version, end).await?;
            }
        }
        sqlx::query("UPDATE invoices SET status='paid',amount_paid_minor=total_minor,paid_at=now(),last_payment_event_at=$2,updated_at=now() WHERE id=$1").bind(event.invoice_id).bind(event.occurred_at).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
        record_event(
            &mut tx,
            org,
            sub_id,
            "payment_verified",
            Some(&sub_status),
            Some("active"),
            "manual_invoice",
            None,
            json!({"invoice_id":event.invoice_id,"provider_reference":event.provider_reference}),
            Some(&event.event_id),
        )
        .await?;
    }
    sqlx::query("UPDATE payment_webhook_events SET processing_status='processed',processed_at=now() WHERE id=$1").bind(webhook_id).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(())
}

async fn plan_interval(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    price: Option<Uuid>,
) -> Result<(Uuid, String), ApiError> {
    let price = price.ok_or(ApiError::NotFound)?;
    let row = sqlx::query("SELECT plan_version_id,billing_interval FROM plan_prices WHERE id=$1")
        .bind(price)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or(ApiError::NotFound)?;
    Ok((row.get("plan_version_id"), row.get("billing_interval")))
}
fn parse_status(status: &str) -> Result<SubscriptionStatus, ApiError> {
    serde_json::from_value(json!(status)).map_err(|e| ApiError::Validation(e.to_string()))
}
async fn transition_update(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    id: Uuid,
    current: &str,
    next: &str,
) -> Result<(), ApiError> {
    validate_transition(parse_status(current)?, parse_status(next)?)
        .map_err(|e| ApiError::Validation(e.to_string()))?;
    sqlx::query("UPDATE subscriptions SET status=$2,updated_at=now() WHERE id=$1")
        .bind(id)
        .bind(next)
        .execute(&mut **tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(())
}
async fn record_event(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    org: Uuid,
    sub: Uuid,
    key: &str,
    from: Option<&str>,
    to: Option<&str>,
    source: &str,
    actor: Option<Uuid>,
    details: Value,
    idempotency: Option<&str>,
) -> Result<(), ApiError> {
    sqlx::query("INSERT INTO subscription_events(organization_id,subscription_id,event_key,from_status,to_status,source,actor_user_id,details,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(subscription_id,idempotency_key) DO NOTHING").bind(org).bind(sub).bind(key).bind(from).bind(to).bind(source).bind(actor).bind(details).bind(idempotency).execute(&mut **tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    Ok(())
}

async fn free_plan(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
) -> Result<(Uuid, Uuid), ApiError> {
    sqlx::query_as("SELECT pv.id,pp.id FROM plans p JOIN plan_versions pv ON pv.plan_id=p.id AND pv.version=1 JOIN plan_prices pp ON pp.plan_version_id=pv.id AND pp.enabled WHERE p.plan_key='free' AND pp.billing_interval='monthly' LIMIT 1").fetch_optional(&mut **tx).await.map_err(|e|ApiError::Internal(e.into()))?.ok_or(ApiError::NotFound)
}
async fn create_free_subscription(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    org: Uuid,
    version: Uuid,
    price: Uuid,
) -> Result<Uuid, ApiError> {
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO subscriptions(id,organization_id,plan_version_id,plan_price_id,status,billing_mode,is_current,current_period_start,current_period_end) VALUES($1,$2,$3,$4,'active','free',true,now(),now()+interval '100 years')").bind(id).bind(org).bind(version).bind(price).execute(&mut **tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    Ok(id)
}
async fn apply_entitlements(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    org: Uuid,
    sub: Uuid,
    version: Uuid,
) -> Result<(), ApiError> {
    sqlx::query("DELETE FROM organization_entitlements WHERE organization_id=$1")
        .bind(org)
        .execute(&mut **tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    sqlx::query("INSERT INTO organization_entitlements(organization_id,feature_key,value,source_subscription_id) SELECT $1,feature_key,feature_value,$2 FROM plan_features WHERE plan_version_id=$3").bind(org).bind(sub).bind(version).execute(&mut **tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    let values =
        sqlx::query("SELECT feature_key,feature_value FROM plan_features WHERE plan_version_id=$1")
            .bind(version)
            .fetch_all(&mut **tx)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    let mut map = std::collections::HashMap::<String, Value>::new();
    for row in values {
        map.insert(row.get("feature_key"), row.get("feature_value"));
    }
    let report_enabled = map
        .get("audit.pdf_export")
        .and_then(Value::as_bool)
        .unwrap_or(false)
        || map
            .get("reports.export")
            .and_then(Value::as_bool)
            .unwrap_or(false);
    let report_limit = feature_int(&map, "reports.monthly_exports")
        .unwrap_or(0)
        .clamp(0, i32::MAX as i64) as i32;
    let report_bytes = feature_int(&map, "reports.max_artifact_bytes")
        .unwrap_or(25_000_000)
        .clamp(1024, 250_000_000);
    sqlx::query("INSERT INTO organization_report_entitlements(organization_id,reports_enabled,monthly_export_limit,max_artifact_bytes) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id) DO UPDATE SET reports_enabled=EXCLUDED.reports_enabled,monthly_export_limit=EXCLUDED.monthly_export_limit,max_artifact_bytes=EXCLUDED.max_artifact_bytes,updated_at=now()")
        .bind(org).bind(report_enabled).bind(report_limit).bind(report_bytes).execute(&mut **tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    let observe = map
        .get("visibility.observe")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let prompts = feature_int(&map, "prompts.track")
        .unwrap_or(0)
        .clamp(0, i32::MAX as i64) as i32;
    let observation_limit = feature_int(&map, "visibility.monthly_observations")
        .unwrap_or(0)
        .clamp(0, i32::MAX as i64) as i32;
    let spend = feature_int(&map, "visibility.monthly_spend_limit_microusd")
        .unwrap_or(0)
        .max(0);
    sqlx::query("INSERT INTO organization_visibility_entitlements(organization_id,enabled,tracked_prompt_limit,monthly_observation_limit,monthly_spend_limit_microusd) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id) DO UPDATE SET enabled=EXCLUDED.enabled,tracked_prompt_limit=EXCLUDED.tracked_prompt_limit,monthly_observation_limit=EXCLUDED.monthly_observation_limit,monthly_spend_limit_microusd=EXCLUDED.monthly_spend_limit_microusd,updated_at=now()")
        .bind(org).bind(observe).bind(prompts).bind(observation_limit).bind(spend).execute(&mut **tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    Ok(())
}
fn feature_int(map: &std::collections::HashMap<String, Value>, key: &str) -> Option<i64> {
    map.get(key).and_then(|v| {
        v.as_i64()
            .or_else(|| v.get("limit").and_then(Value::as_i64))
    })
}
async fn apply_entitlements_for_sub(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    org: Uuid,
    sub: Uuid,
) -> Result<(), ApiError> {
    let version: Uuid = sqlx::query_scalar("SELECT plan_version_id FROM subscriptions WHERE id=$1")
        .bind(sub)
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    apply_entitlements(tx, org, sub, version).await
}
async fn grant_included_credits(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    org: Uuid,
    sub: Uuid,
    version: Uuid,
    expiry: DateTime<Utc>,
) -> Result<(), ApiError> {
    let grant:i64=sqlx::query_scalar("SELECT COALESCE((SELECT (feature_value->>'units')::bigint FROM plan_features WHERE plan_version_id=$1 AND feature_key='credits.included_units'),(SELECT (feature_value#>>'{}')::bigint FROM plan_features WHERE plan_version_id=$1 AND feature_key='credits.included_units'),0)").bind(version).fetch_one(&mut **tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    if grant <= 0 {
        return Ok(());
    }
    let idem = format!("included:{sub}:{}", expiry.timestamp());
    let inserted:Option<Uuid>=sqlx::query_scalar("INSERT INTO credit_transactions(organization_id,amount_units,transaction_type,source_id,expires_at,idempotency_key) VALUES($1,$2,'included_grant',$3,$4,$5) ON CONFLICT(organization_id,idempotency_key) DO NOTHING RETURNING id").bind(org).bind(grant).bind(sub).bind(expiry).bind(&idem).fetch_optional(&mut **tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    if inserted.is_some() {
        sqlx::query("UPDATE credit_accounts SET balance_units=balance_units+$2,updated_at=now() WHERE organization_id=$1").bind(org).bind(grant).execute(&mut **tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    }
    Ok(())
}
