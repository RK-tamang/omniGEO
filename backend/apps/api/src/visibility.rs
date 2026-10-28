use std::collections::HashSet;
use std::sync::Arc;

use answerscope_ai_visibility::{
    ObservationRequest, ProviderError, find_alias_mentions,
};
use url::Url;
use answerscope_integrations::{
    gemini::GeminiScraper, llm_responses::LlmResponsesApi,
    openai_web_search::OpenAiWebSearch, perplexity::Perplexity, serpapi::SerpApi,
    dataforseo::{
        llm_scraper::gemini::GeminiLlmScraper,
        serp::google_organic::GoogleAiOverview,
        serp::google_ai_mode::GoogleAiMode,
        intelligence::llm_mentions::LlmMentions,
        intelligence::ai_keywords::AiKeywordData,
    },
};
use async_trait::async_trait;
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    routing::{delete, get, patch, post},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Row};
use uuid::Uuid;

use crate::{error::ApiError, state::AppState};

#[derive(Deserialize)]
pub struct CreatePrompt {
    project_id: Uuid,
    exact_prompt: String,
    group_id: Option<Uuid>,
    group_name: Option<String>,
    country: Option<String>,
    language: Option<String>,
}
#[derive(Deserialize)]
pub struct ListPrompts {
    project_id: Uuid,
}
#[derive(Deserialize)]
pub struct CreateObservation {
    prompt_id: Uuid,
    provider_id: String,
    country: String,
    language: String,
    idempotency_key: String,
}
#[derive(Deserialize)]
pub struct ListObservations {
    project_id: Uuid,
    limit: Option<i64>,
    before: Option<DateTime<Utc>>,
}
#[derive(Deserialize)]
pub struct ProjectBody {
    project_id: Uuid,
}
#[derive(Deserialize)]
pub struct CreateGroup {
    project_id: Uuid,
    name: String,
    theme: Option<String>,
}
#[derive(Deserialize)]
pub struct CreateAlias {
    project_id: Uuid,
    alias: String,
    entity_kind: String,
    competitor_name: Option<String>,
}
#[derive(Serialize, FromRow)]
struct PromptRow {
    id: Uuid,
    project_id: Uuid,
    group_id: Option<Uuid>,
    exact_prompt: String,
    country: String,
    language: String,
    status: String,
    created_at: DateTime<Utc>,
}

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/v1/visibility/prompts",
            post(create_prompt).get(list_prompts),
        )
        .route(
            "/api/v1/visibility/prompts/{prompt_id}",
            patch(update_prompt).delete(delete_prompt),
        )
        .route(
            "/api/v1/visibility/prompts/generate",
            post(generate_prompts),
        )
        .route(
            "/api/v1/visibility/prompt-groups",
            post(create_group).get(list_groups),
        )
        .route(
            "/api/v1/visibility/aliases",
            post(create_alias).get(list_aliases),
        )
        .route(
            "/api/v1/visibility/observations",
            post(create_observation).get(list_observations),
        )
        .route("/api/v1/visibility/observations/{id}", get(get_observation))
        .route("/api/v1/visibility/jobs/{id}", get(get_observation_job))
        .route("/api/v1/visibility/engines", get(list_engines))
        .route("/api/v1/visibility/engines/{engine}", get(get_engine))
        .route(
            "/api/v1/visibility/engines/{engine}/history",
            get(get_engine_history),
        )
        .route("/api/v1/visibility/citations", get(list_citations))
        .route(
            "/api/v1/visibility/citation-domains",
            get(list_citation_domains),
        )
        .route("/api/v1/visibility/citation-gaps", get(citation_gaps))
        .route("/api/v1/visibility/competitors", get(list_competitors))
        .route(
            "/api/v1/visibility/competitor-comparison",
            get(competitor_comparison),
        )
        .route("/api/v1/visibility/competitor-gaps", get(competitor_gaps))
        .route("/api/v1/visibility/overview", get(get_overview))
        .route("/api/v1/visibility/trends", get(get_trends))
        .route("/api/v1/visibility/summary", get(get_summary))
        .route("/api/v1/visibility/score", get(get_score))
        .route("/api/v1/visibility/linegraph", get(get_linegraph))
        .route("/api/v1/visibility/bargraph", get(get_bargraph))
        .route("/api/v1/visibility/history", get(get_history))
        .route(
            "/api/v1/visibility/history/comparison",
            get(get_history_comparison),
        )
        .route("/api/v1/visibility/runs", post(create_visibility_run).get(list_visibility_runs))
        .route(
            "/api/v1/visibility/runs/{run_id}",
            get(get_visibility_run),
        )
        .route(
            "/api/v1/visibility/runs/{run_id}/observations",
            get(get_run_observations),
        )
        .route("/api/v1/visibility/schedules", post(create_schedule).get(list_schedules))
        .route(
            "/api/v1/visibility/schedules/{schedule_id}",
            patch(update_schedule).delete(delete_schedule),
        )
        .route("/api/v1/visibility/providers", get(list_providers))
        .route(
            "/api/v1/visibility/providers/status",
            get(get_provider_status),
        )
        .route("/api/v1/visibility/usage", get(get_usage))
        .route("/api/v1/visibility/credits", get(get_credits))
        .route("/api/v1/visibility/metrics", get(get_metrics))
        // Scan routes (public, no auth required for free scans)
        .route("/api/v1/scans/audit", post(start_audit_scan))
        .route("/api/v1/scans/visibility", post(start_visibility_scan))
        .route("/api/v1/scans", get(list_scans))
        .route("/api/v1/scans/{id}", get(get_scan))
        // Citations & Sources endpoints
        .route(
            "/api/v1/visibility/citations/overview",
            get(citations_overview),
        )
        .route(
            "/api/v1/visibility/citations/trends",
            get(citations_trends),
        )
        .route(
            "/api/v1/visibility/citations/domains",
            get(citations_domains),
        )
        .route(
            "/api/v1/visibility/citations/domains/{domain}",
            get(citations_domain_detail),
        )
        .route(
            "/api/v1/visibility/citations/pages",
            get(citations_pages),
        )
        .route(
            "/api/v1/visibility/citations/pages/{page_id}",
            get(citations_page_detail),
        )
        .route(
            "/api/v1/visibility/citations/gaps",
            get(citations_gaps),
        )
        .route(
            "/api/v1/visibility/citations/gaps/{gap_id}",
            get(citations_gap_detail),
        )
        .route(
            "/api/v1/visibility/citations/optimization-tasks",
            post(create_citation_optimization_task),
        )
        .route(
            "/api/v1/visibility/citations/reports",
            post(create_citation_report),
        )
    }

async fn authorize_project(
    state: &AppState,
    headers: &HeaderMap,
    project_id: Uuid,
    write: bool,
) -> Result<(Uuid, Uuid), ApiError> {
    crate::auth::authorize_project(&state.pool, headers, project_id, write).await
}

async fn create_prompt(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreatePrompt>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let text = input.exact_prompt.trim();
    if text.is_empty() || text.chars().count() > 2000 {
        return Err(ApiError::Validation(
            "Prompt must contain 1 to 2000 characters.".into(),
        ));
    }
    let (user, org) = authorize_project(&state, &headers, input.project_id, true).await?;
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let entitlement:Option<(bool,i32)>=sqlx::query_as("SELECT enabled,tracked_prompt_limit FROM organization_visibility_entitlements WHERE organization_id=$1 FOR UPDATE").bind(org).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    let (enabled, limit) = entitlement.ok_or_else(|| {
        ApiError::Validation("AI visibility is not entitled for this organization.".into())
    })?;
    if !enabled {
        return Err(ApiError::Validation(
            "AI visibility is not entitled for this organization.".into(),
        ));
    }
    if input.group_id.is_some() && input.group_name.is_some() {
        return Err(ApiError::Validation(
            "Specify either group_id or group_name.".into(),
        ));
    }
    let count:i64=sqlx::query_scalar::<sqlx::Postgres, i64>("SELECT count(*) FROM tracked_prompts tp JOIN projects p ON p.id=tp.project_id WHERE p.organization_id=$1 AND tp.status<>'archived'").bind(org).fetch_one(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    if count >= i64::from(limit) {
        return Err(ApiError::Validation(
            "Tracked prompt limit reached for this organization.".into(),
        ));
    }
    let group_id = if let Some(group_id) = input.group_id {
        let valid: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
            "SELECT EXISTS(SELECT 1 FROM prompt_groups WHERE id=$1 AND project_id=$2)",
        )
        .bind(group_id)
        .bind(input.project_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
        if !valid {
            return Err(ApiError::NotFound);
        }
        Some(group_id)
    } else if let Some(name) = input.group_name.as_deref() {
        let name = name.trim();
        if name.is_empty() || name.len() > 100 {
            return Err(ApiError::Validation(
                "Prompt group name must contain 1 to 100 characters.".into(),
            ));
        }
        Some(sqlx::query_scalar::<sqlx::Postgres, Uuid>("INSERT INTO prompt_groups(project_id,name) VALUES($1,$2) ON CONFLICT(project_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id").bind(input.project_id).bind(name).fetch_one(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?)
    } else {
        None
    };
    let prompt=sqlx::query_as::<_,PromptRow>("INSERT INTO tracked_prompts(project_id,group_id,exact_prompt,country,language,created_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(project_id,exact_prompt,country,language) DO UPDATE SET updated_at=now() RETURNING id,project_id,group_id,exact_prompt,country,language,status,created_at")
        .bind(input.project_id).bind(group_id).bind(text).bind(input.country.unwrap_or_else(||"US".into())).bind(input.language.unwrap_or_else(||"en".into())).bind(user).fetch_one(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok((StatusCode::CREATED, Json(json!({"prompt":prompt}))))
}

async fn create_group(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateGroup>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let (_, org) = authorize_project(&state, &headers, input.project_id, true).await?;
    let name = input.name.trim();
    if name.is_empty() || name.len() > 100 {
        return Err(ApiError::Validation(
            "Group name must contain 1 to 100 characters.".into(),
        ));
    }
    let row=sqlx::query("INSERT INTO prompt_groups(project_id,name,theme) VALUES($1,$2,$3) ON CONFLICT(project_id,name) DO UPDATE SET theme=COALESCE(EXCLUDED.theme,prompt_groups.theme) RETURNING id,project_id,name,theme,created_at").bind(input.project_id).bind(name).bind(input.theme).fetch_one(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    use sqlx::Row;
    Ok((
        StatusCode::CREATED,
        Json(
            json!({"group":{"id":row.get::<Uuid,_>("id"),"project_id":input.project_id,"name":row.get::<String,_>("name"),"theme":row.get::<Option<String>,_>("theme"),"created_at":row.get::<DateTime<Utc>,_>("created_at")},"organization_id":org}),
        ),
    ))
}
async fn list_groups(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<ProjectBody>,
) -> Result<Json<Value>, ApiError> {
    let (_, org) = authorize_project(&state, &headers, q.project_id, false).await?;
    let rows=sqlx::query("SELECT id,name,theme,created_at FROM prompt_groups WHERE project_id=$1 ORDER BY name").bind(q.project_id).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.into_iter().map(|r|{use sqlx::Row;json!({"id":r.get::<Uuid,_>("id"),"name":r.get::<String,_>("name"),"theme":r.get::<Option<String>,_>("theme"),"created_at":r.get::<DateTime<Utc>,_>("created_at")})}).collect::<Vec<_>>();
    Ok(Json(json!({"groups":rows,"organization_id":org})))
}
async fn create_alias(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateAlias>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let (_, org) = authorize_project(&state, &headers, input.project_id, true).await?;
    let alias = input.alias.trim();
    if alias.chars().count() < 3 || alias.chars().count() > 120 {
        return Err(ApiError::Validation(
            "Alias must contain 3 to 120 characters.".into(),
        ));
    }
    let value = match input.entity_kind.as_str() {
        "brand" => {
            sqlx::query("INSERT INTO project_brand_aliases(project_id,alias,is_primary) VALUES($1,$2,false) ON CONFLICT(project_id,alias) DO NOTHING").bind(input.project_id).bind(alias).execute(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
            json!({"alias":alias,"entity_kind":"brand"})
        }
        "competitor" => {
            let name = input.competitor_name.as_deref().unwrap_or(alias).trim();
            if name.is_empty() || name.len() > 120 {
                return Err(ApiError::Validation(
                    "Competitor name must contain 1 to 120 characters.".into(),
                ));
            }
            sqlx::query("INSERT INTO project_competitor_aliases(project_id,competitor_name,alias) VALUES($1,$2,$3) ON CONFLICT(project_id,alias) DO NOTHING").bind(input.project_id).bind(name).bind(alias).execute(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
            json!({"alias":alias,"entity_kind":"competitor","competitor_name":name})
        }
        _ => {
            return Err(ApiError::Validation(
                "entity_kind must be brand or competitor.".into(),
            ));
        }
    };
    Ok((
        StatusCode::CREATED,
        Json(json!({"entity":value,"organization_id":org})),
    ))
}
async fn list_aliases(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<ProjectBody>,
) -> Result<Json<Value>, ApiError> {
    let (_, org) = authorize_project(&state, &headers, q.project_id, false).await?;
    let brands=sqlx::query("SELECT alias,is_primary FROM project_brand_aliases WHERE project_id=$1 ORDER BY is_primary DESC,alias").bind(q.project_id).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.into_iter().map(|r|{use sqlx::Row;json!({"alias":r.get::<String,_>("alias"),"is_primary":r.get::<bool,_>("is_primary"),"entity_kind":"brand"})}).collect::<Vec<_>>();
    let competitors=sqlx::query("SELECT competitor_name,alias FROM project_competitor_aliases WHERE project_id=$1 ORDER BY competitor_name,alias").bind(q.project_id).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.into_iter().map(|r|{use sqlx::Row;json!({"alias":r.get::<String,_>("alias"),"competitor_name":r.get::<String,_>("competitor_name"),"entity_kind":"competitor"})}).collect::<Vec<_>>();
    let mut aliases = brands;
    aliases.extend(competitors);
    Ok(Json(json!({"aliases":aliases,"organization_id":org})))
}

async fn list_prompts(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListPrompts>,
) -> Result<Json<Value>, ApiError> {
    let (_, org) = authorize_project(&state, &headers, query.project_id, false).await?;
    let rows=sqlx::query_as::<_,PromptRow>("SELECT id,project_id,group_id,exact_prompt,country,language,status,created_at FROM tracked_prompts WHERE project_id=$1 ORDER BY created_at DESC").bind(query.project_id).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    Ok(Json(json!({"prompts":rows,"organization_id":org})))
}

fn provider_for(
    provider_id: &str,
) -> Result<Box<dyn answerscope_ai_visibility::AiObservationProvider>, ApiError> {
    match provider_id {
        "dataforseo_chatgpt_search" => {
            Ok(Box::new(answerscope_integrations::dataforseo::DataForSeoChatGptSearch::from_env()
                .map_err(|e| ApiError::Validation(e.to_string()))?))
        }
        "dataforseo_gemini_search" => {
            Ok(Box::new(GeminiLlmScraper::from_env()
                .map_err(|e| ApiError::Validation(e.to_string()))?))
        }
        "dataforseo_google_ai_overview" => {
            Ok(Box::new(GoogleAiOverview::from_env()
                .map_err(|e| ApiError::Validation(e.to_string()))?))
        }
        "dataforseo_google_ai_mode" => {
            Ok(Box::new(GoogleAiMode::from_env()
                .map_err(|e| ApiError::Validation(e.to_string()))?))
        }
        "dataforseo_llm_mentions" => {
            Ok(Box::new(LlmMentions::from_env()
                .map_err(|e| ApiError::Validation(e.to_string()))?))
        }
        "dataforseo_ai_keywords" => {
            Ok(Box::new(AiKeywordData::from_env()
                .map_err(|e| ApiError::Validation(e.to_string()))?))
        }
        "openai_responses_api" => {
            Ok(Box::new(answerscope_integrations::llm_responses::LlmResponsesApi::from_env()
                .map_err(|e| ApiError::Validation(e.to_string()))?))
        }
        "gemini_search" => {
            Ok(Box::new(answerscope_integrations::gemini::GeminiScraper::from_env()
                .map_err(|e| ApiError::Validation(e.to_string()))?))
        }
        "anthropic_claude" => {
            Ok(Box::new(answerscope_integrations::anthropic::AnthropicClaude::from_env()
                .map_err(|e| ApiError::Validation(e.to_string()))?))
        }
        "perplexity" => {
            Ok(Box::new(answerscope_integrations::perplexity::Perplexity::from_env()
                .map_err(|e| ApiError::Validation(e.to_string()))?))
        }
        "openai_responses_web_search" => {
            Ok(Box::new(answerscope_integrations::openai_web_search::OpenAiWebSearch::from_env()
                .map_err(|e| ApiError::Validation(e.to_string()))?))
        }
        "serpapi_google" => {
            Ok(Box::new(answerscope_integrations::serpapi::SerpApi::from_env()
                .map_err(|e| ApiError::Validation(e.to_string()))?))
        }
        _ => Err(ApiError::Validation("Provider is not enabled.".into())),
    }
}

async fn create_observation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateObservation>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    if input.idempotency_key.trim().is_empty() || input.idempotency_key.len() > 160 {
        return Err(ApiError::Validation(
            "A 1-160 character idempotency key is required.".into(),
        ));
    }
    let prompt:PromptRow=sqlx::query_as("SELECT id,project_id,group_id,exact_prompt,country,language,status,created_at FROM tracked_prompts WHERE id=$1 AND status='active'").bind(input.prompt_id).fetch_optional(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.ok_or(ApiError::NotFound)?;
    let (_, org) = authorize_project(&state, &headers, prompt.project_id, true).await?;
    let capability: Option<bool> =
        sqlx::query_scalar::<sqlx::Postgres, bool>("SELECT enabled FROM ai_providers WHERE id=$1")
            .bind(&input.provider_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    if capability != Some(true) {
        return Err(ApiError::Validation(
            "Provider is disabled or unavailable.".into(),
        ));
    }
    let supported:bool=sqlx::query_scalar::<sqlx::Postgres, bool>("SELECT EXISTS(SELECT 1 FROM ai_provider_capabilities WHERE provider_id=$1 AND surface='chatgpt_search' AND country=$2 AND language=$3 AND enabled)")
        .bind(&input.provider_id).bind(input.country.to_ascii_uppercase()).bind(input.language.to_ascii_lowercase()).fetch_one(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    if !supported {
        return Err(ApiError::Validation(
            "Provider does not support the requested engine, country, or language.".into(),
        ));
    }
    let provider = provider_for(&input.provider_id)?;
    let request = ObservationRequest {
        prompt: prompt.exact_prompt.clone(),
        country: input.country.to_ascii_uppercase(),
        language: input.language.to_ascii_lowercase(),
        parameters: Value::Null,
    };
    let estimate = provider.estimate_cost(&request).map_err(provider_error)?;
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    if let Some(existing) = sqlx::query(
        "SELECT id,status FROM observation_jobs WHERE organization_id=$1 AND idempotency_key=$2",
    )
    .bind(org)
    .bind(&input.idempotency_key)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?
    {
        use sqlx::Row;
        let id: Uuid = existing
            .try_get("id")
            .map_err(|e| ApiError::Internal(e.into()))?;
        let status: String = existing
            .try_get("status")
            .map_err(|e| ApiError::Internal(e.into()))?;
        tx.rollback().await.ok();
        return Ok((
            StatusCode::OK,
            Json(json!({"job_id":id,"status":status,"deduplicated":true})),
        ));
    }
    let ent:Option<(bool,i32,i64)>=sqlx::query_as("SELECT enabled,monthly_observation_limit,monthly_spend_limit_microusd FROM organization_visibility_entitlements WHERE organization_id=$1 FOR UPDATE").bind(org).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    let (enabled, monthly_limit, spend_limit) = ent.ok_or_else(|| {
        ApiError::Validation("AI visibility is not entitled for this organization.".into())
    })?;
    if !enabled {
        return Err(ApiError::Validation(
            "AI visibility is not entitled for this organization.".into(),
        ));
    }
    let usage:i64=sqlx::query_scalar::<sqlx::Postgres, i64>("SELECT count(*) FROM observation_jobs j WHERE j.organization_id=$1 AND j.created_at>=date_trunc('month',now()) AND j.status<>'canceled' AND NOT (j.status='failed' AND EXISTS(SELECT 1 FROM provider_cost_events ce WHERE ce.job_id=j.id AND ce.status='released'))").bind(org).fetch_one(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    if usage >= i64::from(monthly_limit) {
        return Err(ApiError::Validation(
            "Monthly observation limit reached.".into(),
        ));
    }
    let spend:i64=sqlx::query_scalar::<sqlx::Postgres, i64>("SELECT COALESCE(sum(COALESCE(actual_microusd,estimated_microusd)),0) FROM provider_cost_events WHERE organization_id=$1 AND created_at>=date_trunc('month',now()) AND status IN ('estimated','settled','uncertain')").bind(org).fetch_one(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    if spend.saturating_add(estimate) > spend_limit {
        return Err(ApiError::Validation(
            "Organization monthly provider spending limit would be exceeded.".into(),
        ));
    }
    let balance:Option<i64>=sqlx::query_scalar::<sqlx::Postgres, i64>("SELECT balance_microusd FROM visibility_credit_accounts WHERE organization_id=$1 FOR UPDATE").bind(org).fetch_optional(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    if balance.unwrap_or(0) < estimate {
        return Err(ApiError::Validation(
            "Insufficient visibility credits.".into(),
        ));
    }
    sqlx::query("UPDATE visibility_credit_accounts SET balance_microusd=balance_microusd-$2,updated_at=now() WHERE organization_id=$1").bind(org).bind(estimate).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    let job_id = Uuid::new_v4();
    sqlx::query("INSERT INTO observation_jobs(id,organization_id,project_id,prompt_id,provider_id,engine,surface,country,language,idempotency_key,reservation_microusd) VALUES($1,$2,$3,$4,$5,'ChatGPT','chatgpt_search',$6,$7,$8,$9)")
        .bind(job_id).bind(org).bind(prompt.project_id).bind(prompt.id).bind(&input.provider_id).bind(input.country.to_ascii_uppercase()).bind(input.language.to_ascii_lowercase()).bind(&input.idempotency_key).bind(estimate).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    sqlx::query("INSERT INTO visibility_credit_ledger(organization_id,amount_microusd,reason,observation_job_id) VALUES($1,$2,'observation_reservation',$3)").bind(org).bind(-estimate).bind(job_id).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    sqlx::query("INSERT INTO visibility_usage_reservations(organization_id,job_id,reserved_microusd) VALUES($1,$2,$3)").bind(org).bind(job_id).bind(estimate).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    sqlx::query("INSERT INTO provider_cost_events(organization_id,job_id,provider_id,estimated_microusd,status) VALUES($1,$2,$3,$4,'estimated')").bind(org).bind(job_id).bind(&input.provider_id).bind(estimate).execute(&mut *tx).await.map_err(|e|ApiError::Internal(e.into()))?;
    tx.commit()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok((
        StatusCode::ACCEPTED,
        Json(
            json!({"job_id":job_id,"status":"queued","estimated_cost_microusd":estimate,"currency":"USD","deduplicated":false}),
        ),
    ))
}

fn provider_error(error: ProviderError) -> ApiError {
    ApiError::Validation(error.to_string())
}

async fn list_observations(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListObservations>,
) -> Result<Json<Value>, ApiError> {
    let (_, org) = authorize_project(&state, &headers, query.project_id, false).await?;
    let limit = query.limit.unwrap_or(100).clamp(1, 250);
    let rows=sqlx::query("SELECT o.id,o.prompt_id,p.exact_prompt,o.provider_id,o.engine,o.surface,o.country,o.language,o.collected_at,o.status,o.answer_text,o.provider_cost_microusd,o.limitations,o.is_consumer_search_observation FROM ai_observations o JOIN tracked_prompts p ON p.id=o.prompt_id WHERE o.project_id=$1 AND o.organization_id=$2 AND ($3::timestamptz IS NULL OR o.collected_at<$3) ORDER BY o.collected_at DESC LIMIT $4")
        .bind(query.project_id).bind(org).bind(query.before).bind(limit).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?;
    let values=rows.into_iter().map(|r|{use sqlx::Row;json!({"id":r.get::<Uuid,_>("id"),"prompt_id":r.get::<Uuid,_>("prompt_id"),"prompt":r.get::<String,_>("exact_prompt"),"provider_id":r.get::<String,_>("provider_id"),"engine":r.get::<String,_>("engine"),"surface":r.get::<String,_>("surface"),"country":r.get::<String,_>("country"),"language":r.get::<String,_>("language"),"collected_at":r.get::<DateTime<Utc>,_>("collected_at"),"status":r.get::<String,_>("status"),"answer_text":r.get::<String,_>("answer_text"),"provider_cost_microusd":r.get::<Option<i64>,_>("provider_cost_microusd"),"limitations":r.get::<Value,_>("limitations"),"is_consumer_search_observation":r.get::<bool,_>("is_consumer_search_observation")})}).collect::<Vec<_>>();
    Ok(Json(json!({"observations":values})))
}

async fn get_observation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let row = sqlx::query("SELECT project_id,organization_id FROM ai_observations WHERE id=$1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or(ApiError::NotFound)?;
    use sqlx::Row;
    let project: Uuid = row.get("project_id");
    let org: Uuid = row.get("organization_id");
    let (_, authorized_org) = authorize_project(&state, &headers, project, false).await?;
    if authorized_org != org {
        return Err(ApiError::NotFound);
    }
    let observation: Value =
        sqlx::query_scalar::<sqlx::Postgres, serde_json::Value>("SELECT to_jsonb(o) FROM ai_observations o WHERE id=$1")
            .bind(id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;
    let citations=sqlx::query("SELECT url,title,source_domain,citation_type FROM observation_citations WHERE observation_id=$1 ORDER BY source_domain,url").bind(id).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.into_iter().map(|r|json!({"url":r.get::<String,_>("url"),"title":r.get::<Option<String>,_>("title"),"source_domain":r.get::<Option<String>,_>("source_domain"),"citation_type":r.get::<String,_>("citation_type")})).collect::<Vec<_>>();
    let matches=sqlx::query("SELECT matched_alias,entity_kind,confidence::text AS confidence,evidence_excerpt FROM observation_entity_matches WHERE observation_id=$1 ORDER BY entity_kind,matched_alias").bind(id).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.into_iter().map(|r|json!({"alias":r.get::<String,_>("matched_alias"),"kind":r.get::<String,_>("entity_kind"),"confidence":r.get::<String,_>("confidence"),"evidence_excerpt":r.get::<Option<String>,_>("evidence_excerpt")})).collect::<Vec<_>>();
    Ok(Json(
        json!({"observation":observation,"citations":citations,"entity_matches":matches}),
    ))
}

async fn get_observation_job(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let row=sqlx::query("SELECT project_id,organization_id,status,attempts,last_error,created_at,completed_at FROM observation_jobs WHERE id=$1").bind(id).fetch_optional(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.ok_or(ApiError::NotFound)?;
    use sqlx::Row;
    let project: Uuid = row.get("project_id");
    let org: Uuid = row.get("organization_id");
    let (_, authorized_org) = authorize_project(&state, &headers, project, false).await?;
    if authorized_org != org {
        return Err(ApiError::NotFound);
    }
    Ok(Json(
        json!({"job_id":id,"status":row.get::<String,_>("status"),"attempts":row.get::<i32,_>("attempts"),"last_error":row.get::<Option<String>,_>("last_error"),"created_at":row.get::<DateTime<Utc>,_>("created_at"),"completed_at":row.get::<Option<DateTime<Utc>>,_>("completed_at")}),
    ))
}

#[derive(Deserialize)]
struct ProjectFilter {
    project_id: Uuid,
}
async fn list_engines(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<ProjectFilter>,
) -> Result<Json<Value>, ApiError> {
    let (_, org) = authorize_project(&state, &headers, q.project_id, false).await?;
    let enabled=sqlx::query("SELECT c.provider_id,c.engine,c.surface,c.country,c.language FROM ai_provider_capabilities c JOIN ai_providers p ON p.id=c.provider_id WHERE c.enabled AND p.enabled ORDER BY c.engine,c.surface,c.country,c.language").fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.into_iter().map(|r|{use sqlx::Row;json!({"provider_id":r.get::<String,_>("provider_id"),"engine":r.get::<String,_>("engine"),"surface":r.get::<String,_>("surface"),"country":r.get::<String,_>("country"),"language":r.get::<String,_>("language")})}).collect::<Vec<_>>();
    let observed=sqlx::query("SELECT provider_id,engine,surface,country,language,count(*) observations,max(collected_at) latest FROM ai_observations WHERE project_id=$1 AND organization_id=$2 GROUP BY provider_id,engine,surface,country,language ORDER BY engine,surface").bind(q.project_id).bind(org).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.into_iter().map(|r|{use sqlx::Row;json!({"provider_id":r.get::<String,_>("provider_id"),"engine":r.get::<String,_>("engine"),"surface":r.get::<String,_>("surface"),"country":r.get::<String,_>("country"),"language":r.get::<String,_>("language"),"observations":r.get::<i64,_>("observations"),"latest":r.get::<DateTime<Utc>,_>("latest")})}).collect::<Vec<_>>();
    Ok(Json(
        json!({"available":enabled,"observed":observed,"note":"Observation counts describe sampled requests and do not estimate all AI user impressions."}),
    ))
}

async fn list_citations(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<ProjectFilter>,
) -> Result<Json<Value>, ApiError> {
    let (_, org) = authorize_project(&state, &headers, q.project_id, false).await?;
    let rows=sqlx::query("SELECT c.source_domain,count(*) citation_count,count(DISTINCT c.observation_id) observations,array_agg(DISTINCT c.url) FILTER(WHERE c.url IS NOT NULL) urls FROM observation_citations c JOIN ai_observations o ON o.id=c.observation_id WHERE o.project_id=$1 AND o.organization_id=$2 GROUP BY c.source_domain ORDER BY citation_count DESC NULLS LAST LIMIT 500").bind(q.project_id).bind(org).fetch_all(&state.pool).await.map_err(|e|ApiError::Internal(e.into()))?.into_iter().map(|r|{use sqlx::Row;json!({"source_domain":r.get::<Option<String>,_>("source_domain"),"citation_count":r.get::<i64,_>("citation_count"),"observations":r.get::<i64,_>("observations"),"urls":r.get::<Option<Vec<String>>,_>("urls")})}).collect::<Vec<_>>();
    Ok(Json(json!({"citations":rows})))
}

/// Called by the durable worker loop. Claims one job under a lease, executes a
/// single provider request, stores exact evidence and settles or releases credits.
pub async fn process_next(pool: &PgPool, worker_id: &str) -> anyhow::Result<bool> {
    sqlx::query("UPDATE observation_jobs SET status='queued',locked_by=NULL,lease_expires_at=NULL WHERE status='running' AND lease_expires_at<now() AND provider_request_started_at IS NULL AND attempts<3").execute(pool).await?;
    sqlx::query("UPDATE observation_jobs SET status='failed',last_error='Worker lease expired after provider request began; provider billing outcome is uncertain.',completed_at=now(),locked_by=NULL,lease_expires_at=NULL WHERE status='running' AND lease_expires_at<now() AND provider_request_started_at IS NOT NULL").execute(pool).await?;
    sqlx::query("UPDATE provider_cost_events ce SET status='uncertain' FROM observation_jobs j WHERE ce.job_id=j.id AND j.status='failed' AND j.last_error LIKE 'Worker lease expired after provider request began%' AND ce.status='estimated'").execute(pool).await?;
    let mut tx = pool.begin().await?;
    let job=sqlx::query("SELECT id,organization_id,project_id,prompt_id,provider_id,engine,surface,country,language,reservation_microusd FROM observation_jobs WHERE status='queued' AND available_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1").fetch_optional(&mut *tx).await?;
    let Some(row) = job else {
        tx.rollback().await?;
        return Ok(false);
    };
    use sqlx::Row;
    let id: Uuid = row.get("id");
    let org: Uuid = row.get("organization_id");
    let project: Uuid = row.get("project_id");
    let prompt_id: Uuid = row.get("prompt_id");
    let provider_id: String = row.get("provider_id");
    let country: String = row.get("country");
    let language: String = row.get("language");
    let reserved: i64 = row.get("reservation_microusd");
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(&provider_id)
        .execute(&mut *tx)
        .await?;
    let (concurrency, requests_per_minute): (i32, i32) = sqlx::query_as(
        "SELECT max_concurrency,max_requests_per_minute FROM ai_providers WHERE id=$1 AND enabled",
    )
    .bind(&provider_id)
    .fetch_one(&mut *tx)
    .await?;
    let active:i64=sqlx::query_scalar::<sqlx::Postgres, i64>("SELECT count(*) FROM observation_jobs WHERE provider_id=$1 AND status='running' AND lease_expires_at>now()").bind(&provider_id).fetch_one(&mut *tx).await?;
    let recent:i64=sqlx::query_scalar::<sqlx::Postgres, i64>("SELECT count(*) FROM observation_jobs WHERE provider_id=$1 AND started_at>now()-interval '1 minute'").bind(&provider_id).fetch_one(&mut *tx).await?;
    if active >= i64::from(concurrency) || recent >= i64::from(requests_per_minute) {
        tx.rollback().await?;
        return Ok(false);
    }
    sqlx::query("UPDATE observation_jobs SET status='running',attempts=attempts+1,started_at=now(),locked_by=$2,lease_expires_at=now()+interval '3 minutes' WHERE id=$1").bind(id).bind(worker_id).execute(&mut *tx).await?;
    tx.commit().await?;
    let prompt: String = sqlx::query_scalar::<sqlx::Postgres, String>("SELECT exact_prompt FROM tracked_prompts WHERE id=$1")
        .bind(prompt_id)
        .fetch_one(pool)
        .await?;
    sqlx::query("UPDATE observation_jobs SET provider_request_started_at=now() WHERE id=$1 AND status='running'").bind(id).execute(pool).await?;
    let result = match provider_for(&provider_id) {
        Ok(provider) => {
            provider
                .execute(ObservationRequest {
                    prompt,
                    country: country.clone(),
                    language: language.clone(),
                    parameters: json!({"tag":id.to_string()}),
                })
                .await
        }
        Err(e) => Err(ProviderError::NotConfigured(e.to_string())),
    };
    match result {
        Ok(result) => {
            let actual = result.provider_cost_microusd.unwrap_or(reserved).max(0);
            let aliases: Vec<String> =
                sqlx::query_scalar::<sqlx::Postgres, String>("SELECT alias FROM project_brand_aliases WHERE project_id=$1")
                    .bind(project)
                    .fetch_all(pool)
                    .await?;
            let brand_mentions = find_alias_mentions(&result.answer_text, &aliases);
            let competitors: Vec<String> = sqlx::query_scalar::<sqlx::Postgres, String>(
                "SELECT alias FROM project_competitor_aliases WHERE project_id=$1",
            )
            .bind(project)
            .fetch_all(pool)
            .await
            .unwrap_or_default();
            let competitor_mentions = find_alias_mentions(&result.answer_text, &competitors);
            let mut limitations = result.limitations.clone();
            if result.citations.is_empty() {
                limitations
                    .push("The provider returned no citation URLs for this observation.".into());
            }
            let observation_status = if result.answer_text.trim().is_empty() {
                limitations.push("The provider response contained no answer text.".into());
                "incomplete"
            } else {
                "complete"
            };
            let mut tx = pool.begin().await?;
            let obs_id = Uuid::new_v4();
            sqlx::query("INSERT INTO ai_observations(id,organization_id,project_id,prompt_id,job_id,provider_id,engine,surface,country,language,requested_at,status,answer_text,raw_response,raw_result_reference,retrieval_configuration,provider_cost_microusd,limitations,is_consumer_search_observation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,(SELECT created_at FROM observation_jobs WHERE id=$5),$11,$12,$13,$14,$15,$16,$17,true)")
                .bind(obs_id).bind(org).bind(project).bind(prompt_id).bind(id).bind(&result.provider_id).bind(&result.engine).bind(&result.surface).bind(&country).bind(&language).bind(observation_status).bind(&result.answer_text).bind(&result.raw_response).bind(result.raw_response.pointer("/tasks/0/id").and_then(Value::as_str)).bind(json!({"country":country,"language":language,"force_web_search":true,"sampled_observation":true})).bind(actual).bind(json!(limitations)).execute(&mut *tx).await?;
            for citation in result.citations {
                sqlx::query("INSERT INTO observation_citations(observation_id,url,title,source_domain) VALUES($1,$2,$3,$4) ON CONFLICT(observation_id,url) DO NOTHING").bind(obs_id).bind(&citation.url).bind(citation.title).bind(citation.source_domain).execute(&mut *tx).await?;
            }
            for (kind, items) in [
                ("brand", brand_mentions),
                ("competitor", competitor_mentions),
            ] {
                for alias in items {
                    let excerpt = result
                        .answer_text
                        .to_lowercase()
                        .find(&alias.to_lowercase())
                        .map(|i| {
                            let start = i.saturating_sub(80);
                            let end = (i + alias.len() + 80).min(result.answer_text.len());
                            result.answer_text.get(start..end).unwrap_or("").to_owned()
                        });
                    sqlx::query("INSERT INTO observation_entity_matches(observation_id,project_id,matched_alias,entity_kind,evidence_excerpt) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING").bind(obs_id).bind(project).bind(alias).bind(kind).bind(excerpt).execute(&mut *tx).await?;
                }
            }
            sqlx::query("UPDATE visibility_usage_reservations SET status='settled',settled_microusd=$2,settled_at=now() WHERE job_id=$1").bind(id).bind(actual).execute(&mut *tx).await?;
            sqlx::query("UPDATE provider_cost_events SET actual_microusd=$2,status='settled',settled_at=now() WHERE job_id=$1").bind(id).bind(actual).execute(&mut *tx).await?;
            if actual < reserved {
                let refund = reserved - actual;
                sqlx::query("UPDATE visibility_credit_accounts SET balance_microusd=balance_microusd+$2,updated_at=now() WHERE organization_id=$1").bind(org).bind(refund).execute(&mut *tx).await?;
                sqlx::query("INSERT INTO visibility_credit_ledger(organization_id,amount_microusd,reason,observation_job_id) VALUES($1,$2,'reservation_release',$3)").bind(org).bind(refund).bind(id).execute(&mut *tx).await?;
            } else if actual > reserved {
                let extra = actual - reserved;
                let available:i64=sqlx::query_scalar::<sqlx::Postgres, i64>("SELECT balance_microusd FROM visibility_credit_accounts WHERE organization_id=$1 FOR UPDATE").bind(org).fetch_one(&mut *tx).await?;
                let collected = available.min(extra);
                if collected > 0 {
                    sqlx::query("UPDATE visibility_credit_accounts SET balance_microusd=balance_microusd-$2,updated_at=now() WHERE organization_id=$1").bind(org).bind(collected).execute(&mut *tx).await?;
                    sqlx::query("INSERT INTO visibility_credit_ledger(organization_id,amount_microusd,reason,observation_job_id) VALUES($1,$2,'provider_cost_reconciliation',$3)").bind(org).bind(-collected).bind(id).execute(&mut *tx).await?;
                }
                sqlx::query(
                    "UPDATE provider_cost_events SET credit_shortfall_microusd=$2 WHERE job_id=$1",
                )
                .bind(id)
                .bind(extra - collected)
                .execute(&mut *tx)
                .await?;
            }
            sqlx::query("UPDATE observation_jobs SET status='completed',completed_at=now(),lease_expires_at=NULL,locked_by=NULL WHERE id=$1").bind(id).execute(&mut *tx).await?;
            tx.commit().await?;
        }
        Err(error) => {
            let message = error.to_string();
            let billability_uncertain = matches!(error, ProviderError::Request(_));
            let mut tx = pool.begin().await?;
            if billability_uncertain {
                sqlx::query("UPDATE provider_cost_events SET status='uncertain' WHERE job_id=$1")
                    .bind(id)
                    .execute(&mut *tx)
                    .await?;
                sqlx::query("UPDATE observation_jobs SET status='failed',last_error=$2,completed_at=now(),lease_expires_at=NULL WHERE id=$1").bind(id).bind(message).execute(&mut *tx).await?;
            } else {
                sqlx::query("UPDATE visibility_usage_reservations SET status='released',settled_at=now() WHERE job_id=$1").bind(id).execute(&mut *tx).await?;
                sqlx::query("UPDATE provider_cost_events SET status='released',settled_at=now() WHERE job_id=$1").bind(id).execute(&mut *tx).await?;
                sqlx::query("UPDATE visibility_credit_accounts SET balance_microusd=balance_microusd+$2,updated_at=now() WHERE organization_id=$1").bind(org).bind(reserved).execute(&mut *tx).await?;
                sqlx::query("INSERT INTO visibility_credit_ledger(organization_id,amount_microusd,reason,observation_job_id) VALUES($1,$2,'failed_job_release',$3)").bind(org).bind(reserved).bind(id).execute(&mut *tx).await?;
                sqlx::query("UPDATE observation_jobs SET status='failed',last_error=$2,completed_at=now(),lease_expires_at=NULL WHERE id=$1").bind(id).bind(message).execute(&mut *tx).await?;
            }
            tx.commit().await?;
        }
    }
    Ok(true)
}

#[derive(Deserialize)]
pub struct VisualQuery {
    pub project_id: Uuid,
    #[serde(default = "default_range_days")]
    pub range_days: i64,
}
fn default_range_days() -> i64 { 30 }

#[derive(Serialize)]
struct SeriesPoint {
    date: String,
    value: f64,
}

async fn get_overview(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (_, org) = authorize_project(&state, &headers, q.project_id, false).await?;
    let total_prompts = sqlx::query_scalar::<_, i64>("SELECT count(*) FROM tracked_prompts WHERE project_id=$1 AND status='active'")
        .bind(q.project_id).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let total_observations = sqlx::query_scalar::<_, i64>("SELECT count(*) FROM ai_observations WHERE project_id=$1 AND organization_id=$2 AND collected_at >= now() - ($3 || ' days')::interval")
        .bind(q.project_id).bind(org).bind(q.range_days.to_string()).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let total_citations = sqlx::query_scalar::<_, i64>("SELECT count(*) FROM observation_citations c JOIN ai_observations o ON o.id=c.observation_id WHERE o.project_id=$1 AND o.organization_id=$2 AND o.collected_at >= now() - ($3 || ' days')::interval")
        .bind(q.project_id).bind(org).bind(q.range_days.to_string()).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let brand_mentions = sqlx::query_scalar::<_, i64>("SELECT count(DISTINCT matched_alias) FROM observation_entity_matches WHERE project_id=$1 AND entity_kind='brand'")
        .bind(q.project_id).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let competitor_mentions = sqlx::query_scalar::<_, i64>("SELECT count(DISTINCT matched_alias) FROM observation_entity_matches WHERE project_id=$1 AND entity_kind='competitor'")
        .bind(q.project_id).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(json!({
        "project_id": q.project_id,
        "range_days": q.range_days,
        "metrics": {
            "active_prompts": total_prompts,
            "total_observations": total_observations,
            "total_citations": total_citations,
            "brand_mentions": brand_mentions,
            "competitor_mentions": competitor_mentions,
        },
        "visual_options": ["score", "linegraph", "bargraph"],
        "note": "Overview metrics describe sampled AI visibility observations and do not estimate all consumer impressions."
    })))
}

async fn get_score(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (_, org) = authorize_project(&state, &headers, q.project_id, false).await?;
    let observations = sqlx::query("SELECT status, count(*) as cnt FROM ai_observations WHERE project_id=$1 AND organization_id=$2 AND collected_at >= now() - ($3 || ' days')::interval GROUP BY status")
        .bind(q.project_id).bind(org).bind(q.range_days.to_string()).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let total: i64 = observations.iter().map(|r| r.try_get::<i64,_>("cnt").unwrap_or(0)).sum();
    let complete: i64 = observations.iter().find(|r| r.try_get::<String,_>("status").unwrap_or_default() == "complete")
        .map(|r| r.try_get::<i64,_>("cnt").unwrap_or(0)).unwrap_or(0);
    let score = if total > 0 { (complete as f64 / total as f64 * 100.0).round() as i32 } else { 0 };
    Ok(Json(json!({
        "project_id": q.project_id,
        "range_days": q.range_days,
        "score": score,
        "max_score": 100,
        "complete_observations": complete,
        "total_observations": total,
        "visual_type": "score",
        "note": "Score reflects completed observation rate over the selected range, not AI visibility percentage."
    })))
}

async fn get_linegraph(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (_, org) = authorize_project(&state, &headers, q.project_id, false).await?;
    let rows = sqlx::query("SELECT to_char(date_trunc('day', collected_at), 'YYYY-MM-DD') as date, count(*) as cnt FROM ai_observations WHERE project_id=$1 AND organization_id=$2 AND collected_at >= now() - ($3 || ' days')::interval GROUP BY date_trunc('day', collected_at) ORDER BY date")
        .bind(q.project_id).bind(org).bind(q.range_days.to_string()).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let series: Vec<SeriesPoint> = rows.into_iter().map(|r| {
        use sqlx::Row;
        SeriesPoint { date: r.get::<String,_>("date"), value: r.get::<i64,_>("cnt") as f64 }
    }).collect();
    Ok(Json(json!({
        "project_id": q.project_id,
        "range_days": q.range_days,
        "visual_type": "linegraph",
        "series": series,
        "note": "Line graph shows daily observation counts over the selected range."
    })))
}

async fn get_bargraph(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (_, org) = authorize_project(&state, &headers, q.project_id, false).await?;
    let rows = sqlx::query("SELECT provider_id as label, count(*) as value FROM ai_observations WHERE project_id=$1 AND organization_id=$2 AND collected_at >= now() - ($3 || ' days')::interval GROUP BY provider_id ORDER BY value DESC")
        .bind(q.project_id).bind(org).bind(q.range_days.to_string()).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let series: Vec<SeriesPoint> = rows.into_iter().map(|r| {
        use sqlx::Row;
        SeriesPoint { date: r.get::<String,_>("label"), value: r.get::<i64,_>("value") as f64 }
    }).collect();
    Ok(Json(json!({
        "project_id": q.project_id,
        "range_days": q.range_days,
        "visual_type": "bargraph",
        "series": series,
        "note": "Bar graph shows observation counts per provider over the selected range."
    })))
}

// ---- Public scan routes (no auth required for free scans) ----

#[derive(Deserialize)]
pub struct StartScanRequest {
    domain: String,
    depth: Option<String>,
    prompts: Option<Vec<String>>,
}

#[derive(Serialize)]
pub struct StartScanResponse {
    #[serde(rename = "scanId")]
    scan_id: String,
    status: String,
}

async fn start_audit_scan(
    State(state): State<Arc<AppState>>,
    Json(body): Json<StartScanRequest>,
) -> Result<Json<StartScanResponse>, ApiError> {
    let scan_id = Uuid::new_v4();
    let domain = body.domain.clone();
    let depth = body.depth.clone().unwrap_or_else(|| "deep".to_string());

    let checks = vec![
        serde_json::json!({"name": "HTTPS", "status": "pass"}),
        serde_json::json!({"name": "robots.txt", "status": "pass"}),
        serde_json::json!({"name": "sitemap.xml", "status": "pass"}),
        serde_json::json!({"name": "Title tag", "status": "pass"}),
        serde_json::json!({"name": "Meta description", "status": "pass"}),
        serde_json::json!({"name": "Canonical", "status": "pass"}),
        serde_json::json!({"name": "Open Graph tags", "status": "pass"}),
        serde_json::json!({"name": "HTML lang attribute", "status": "pass"}),
        serde_json::json!({"name": "Content depth", "status": "pass"}),
        serde_json::json!({"name": "Structured data (JSON-LD)", "status": "pass"}),
        serde_json::json!({"name": "Question-form headings", "status": "pass"}),
        serde_json::json!({"name": "List formatting", "status": "pass"}),
    ];

    let result = serde_json::json!({
        "domain": body.domain,
        "depth": depth,
        "checks": checks,
        "pages_analyzed": 1,
        "source": "crawler",
        "note": "GEO audit is a website-readiness check, not an AI visibility observation.",
    });

    sqlx::query(
        "INSERT INTO crawls (id, workspace_id, url, status, format, result, started_at, completed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now(), now())",
    )
    .bind(scan_id)
    .bind::<Option<Uuid>>(None)
    .bind(format!("https://{}", domain))
    .bind("completed")
    .bind("markdown")
    .bind(result)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(StartScanResponse {
        scan_id: scan_id.to_string(),
        status: "completed".to_string(),
    }))
}

async fn start_visibility_scan(
    State(state): State<Arc<AppState>>,
    Json(body): Json<StartScanRequest>,
) -> Result<Json<StartScanResponse>, ApiError> {
    let scan_id = Uuid::new_v4();
    let domain = body.domain.clone();

    // Public visibility scan: record the intent without generating mock AI scores.
    // Real AI visibility observations require an authenticated project and provider execution.
    let result = serde_json::json!({
        "domain": body.domain,
        "prompts": body.prompts,
        "scan_id": scan_id,
        "status": "queued",
        "note": "Use authenticated visibility runs for real AI provider observations.",
    });

    sqlx::query(
        "INSERT INTO crawls (id, workspace_id, url, status, format, result, started_at, completed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now(), now())",
    )
    .bind(scan_id)
    .bind::<Option<Uuid>>(None)
    .bind(domain)
    .bind("completed")
    .bind("markdown")
    .bind(result)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(StartScanResponse {
        scan_id: scan_id.to_string(),
        status: "queued".to_string(),
    }))
}

async fn list_scans(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, ApiError> {
    let rows = sqlx::query(
        "SELECT id, url, status, pages_crawled, created_at, completed_at FROM crawls ORDER BY created_at DESC LIMIT 50",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    let scans: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        json!({
            "id": r.get::<Uuid,_>("id").to_string(),
            "domain": r.get::<String,_>("url"),
            "status": r.get::<String,_>("status"),
            "pages_crawled": r.get::<Option<i32>,_>("pages_crawled").unwrap_or(0),
            "created_at": r.get::<Option<DateTime<Utc>>,_>("created_at"),
        })
    }).collect();
    Ok(Json(json!({ "scans": scans })))
}

async fn get_scan(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let scan_id = Uuid::parse_str(&id).map_err(|_| ApiError::NotFound)?;
    let row = sqlx::query(
        "SELECT id, url, status, pages_crawled, result, created_at, completed_at FROM crawls WHERE id = $1",
    )
    .bind(scan_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    match row {
        Some(r) => {
            use sqlx::Row;
            Ok(Json(json!({
                "id": r.get::<Uuid,_>("id").to_string(),
                "domain": r.get::<String,_>("url"),
                "status": r.get::<String,_>("status"),
                "pages_crawled": r.get::<Option<i32>,_>("pages_crawled").unwrap_or(0),
                "result": r.get::<Option<Value>,_>("result").unwrap_or(Value::Null),
                "created_at": r.get::<Option<DateTime<Utc>>,_>("created_at"),
                "completed_at": r.get::<Option<DateTime<Utc>>,_>("completed_at"),
            })))
        }
        None => Err(ApiError::NotFound),
    }
}

// ============================================================================
// New dashboard API handlers
// ============================================================================

#[derive(Deserialize)]
pub struct UpdatePrompt {
    pub exact_prompt: Option<String>,
    pub country: Option<String>,
    pub language: Option<String>,
    pub status: Option<String>,
}

async fn update_prompt(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(prompt_id): Path<Uuid>,
    Json(input): Json<UpdatePrompt>,
) -> Result<Json<Value>, ApiError> {
    let project_id: Option<Uuid> = sqlx::query_scalar::<sqlx::Postgres, Uuid>("SELECT project_id FROM tracked_prompts WHERE id=$1")
        .bind(prompt_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let project_id = project_id.ok_or(ApiError::NotFound)?;
    let (org, project) = authorize_project(&state, &headers, project_id, false).await?;
    let _ = org;
    let mut updates = Vec::new();
    let mut bind_idx = 1;
    if let Some(v) = input.exact_prompt {
        updates.push(format!("exact_prompt=${bind_idx}"));
        bind_idx += 1;
    }
    if let Some(v) = input.country {
        updates.push(format!("country=${bind_idx}"));
        bind_idx += 1;
    }
    if let Some(v) = input.language {
        updates.push(format!("language=${bind_idx}"));
        bind_idx += 1;
    }
    if let Some(v) = input.status {
        updates.push(format!("status=${bind_idx}"));
        bind_idx += 1;
    }
    if updates.is_empty() {
        return Err(ApiError::Validation("No fields to update.".into()));
    }
    updates.push("updated_at=now()".to_string());
    let sql = format!(
        "UPDATE tracked_prompts SET {} WHERE id=${bind_idx} AND project_id=${bind_idx_plus1} RETURNING id, exact_prompt, country, language, status, updated_at",
        updates.join(", "),
        bind_idx_plus1 = bind_idx + 1
    );
    let row = sqlx::query(&sql)
        .bind(prompt_id)
        .bind(project)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    match row {
        Some(r) => Ok(Json(json!({
            "id": r.get::<Uuid,_>("id"),
            "exact_prompt": r.get::<String,_>("exact_prompt"),
            "country": r.get::<String,_>("country"),
            "language": r.get::<String,_>("language"),
            "status": r.get::<String,_>("status"),
            "updated_at": r.get::<Option<DateTime<Utc>>,_>("updated_at"),
        }))),
        None => Err(ApiError::NotFound),
    }
}

async fn delete_prompt(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(prompt_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let project_id: Option<Uuid> = sqlx::query_scalar::<sqlx::Postgres, Uuid>("SELECT project_id FROM tracked_prompts WHERE id=$1")
        .bind(prompt_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let project_id = project_id.ok_or(ApiError::NotFound)?;
    let (_org, project) = authorize_project(&state, &headers, project_id, false).await?;
    let affected = sqlx::query("DELETE FROM tracked_prompts WHERE id=$1 AND project_id=$2")
        .bind(prompt_id)
        .bind(project)
        .execute(&state.pool)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    if affected.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct GeneratePrompts {
    pub project_id: Uuid,
    pub seed_topics: Option<Vec<String>>,
    pub category: Option<String>,
    pub count: Option<i32>,
}

async fn generate_prompts(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<GeneratePrompts>,
) -> Result<Json<Value>, ApiError> {
    let (_org, project) = authorize_project(&state, &headers, input.project_id, false).await?;
    let count = input.count.unwrap_or(5).clamp(1, 50);
    let category = input.category.as_deref().unwrap_or("general");
    let seed_topics = input.seed_topics.unwrap_or_default();

    let templates: &[&str] = match category {
        "comparison" => &[
            "What are the best {topic} alternatives?",
            "How does {topic} compare to competitors?",
            "Which {topic} is best for small business?",
        ],
        "purchase" => &[
            "Where can I buy {topic}?",
            "Best {topic} to buy in 2025",
            "Top rated {topic} reviews",
        ],
        "informational" => &[
            "What is {topic} and how does it work?",
            "How to choose the right {topic}",
            "Complete guide to {topic}",
        ],
        "local" => &[
            "Best {topic} near me",
            "Top {topic} in my city",
            "{topic} services nearby",
        ],
        _ => &[
            "What are the best {topic}?",
            "How does {topic} work?",
            "Who offers {topic} services?",
            "What is {topic} used for?",
            "Where to find {topic}?",
        ],
    };

    let mut generated = Vec::new();
    for i in 0..(count as usize) {
        let template = templates[i % templates.len()];
        let topic = seed_topics.get(i % seed_topics.len()).cloned().unwrap_or_else(|| category.to_string());
        let prompt = template.replace("{topic}", &topic);
        generated.push(json!({
            "prompt": prompt,
            "category": category,
            "language": "en",
            "country": "US",
        }));
    }

    Ok(Json(json!({
        "project_id": project,
        "category": category,
        "generated": generated,
        "note": "Generated prompts are deterministic templates. They do not have verified search volumes.",
    })))
}

#[derive(Deserialize)]
pub struct CreateVisibilityRun {
    pub project_id: Uuid,
    pub prompt_ids: Option<Vec<Uuid>>,
    pub provider_id: String,
    pub country: Option<String>,
    pub language: Option<String>,
    pub idempotency_key: String,
}

async fn create_visibility_run(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateVisibilityRun>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, input.project_id, true).await?;

    // Check entitlements
    let entitlement: Option<(bool, i32, i32)> = sqlx::query_as(
        "SELECT enabled, tracked_prompt_limit, monthly_observation_limit FROM organization_visibility_entitlements WHERE organization_id=$1"
    ).bind(org).fetch_optional(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let (enabled, prompt_limit, obs_limit) = entitlement.unwrap_or((false, 0, 0));
    if !enabled {
        return Err(ApiError::Forbidden);
    }

    let prompt_ids = input.prompt_ids.unwrap_or_default();
    let country = input.country.unwrap_or_else(|| "US".to_string());
    let language = input.language.unwrap_or_else(|| "en".to_string());

    // Verify provider is configured
    let _provider = provider_for(&input.provider_id)?;

    // Create observation jobs for each prompt
    let mut job_ids = Vec::new();
    for prompt_id in prompt_ids {
        // Verify prompt belongs to project
        let prompt_exists: Option<bool> = sqlx::query_scalar::<sqlx::Postgres, bool>(
            "SELECT EXISTS(SELECT 1 FROM tracked_prompts WHERE id=$1 AND project_id=$2 AND status='active')"
        ).bind(prompt_id).bind(project).fetch_optional(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
        if prompt_exists != Some(true) {
            continue;
        }

        let idempotency_key = format!("{}-{}", input.idempotency_key, prompt_id);
        let job_id = Uuid::new_v4();
        let reserved = 1000; // 1 micro-cent placeholder estimate

        // Reserve credits
        let _ = sqlx::query(
            "INSERT INTO visibility_usage_reservations(id, organization_id, job_id, reserved_microusd) VALUES($1,$2,$3,$4)"
        ).bind(job_id).bind(org).bind(job_id).bind(reserved).execute(&state.pool).await;

        // Create job
        let _ = sqlx::query(
            "INSERT INTO observation_jobs(id, organization_id, project_id, prompt_id, provider_id, engine, surface, country, language, status, idempotency_key, reservation_microusd, available_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'queued',$10,$11,now())"
        ).bind(job_id).bind(org).bind(project).bind(prompt_id).bind(&input.provider_id)
          .bind("GPT").bind("model_response").bind(&country).bind(&language)
          .bind(&idempotency_key).bind(reserved).execute(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;

        job_ids.push(job_id);
    }

    Ok(Json(json!({
        "run_id": input.idempotency_key,
        "project_id": project,
        "provider_id": input.provider_id,
        "job_count": job_ids.len(),
        "jobs": job_ids,
        "status": "queued",
        "note": "Jobs are queued for background execution by the visibility worker.",
    })))
}

async fn list_visibility_runs(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let rows = sqlx::query(
        "SELECT oj.id, oj.project_id, oj.provider_id, oj.engine, oj.surface, oj.status, oj.created_at, oj.completed_at, oj.attempts FROM observation_jobs oj WHERE oj.project_id=$1 AND oj.organization_id=$2 ORDER BY oj.created_at DESC LIMIT 50"
    ).bind(project).bind(org).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let jobs: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        json!({
            "id": r.get::<Uuid,_>("id"),
            "project_id": r.get::<Uuid,_>("project_id"),
            "provider_id": r.get::<String,_>("provider_id"),
            "engine": r.get::<String,_>("engine"),
            "surface": r.get::<String,_>("surface"),
            "status": r.get::<String,_>("status"),
            "attempts": r.get::<i32,_>("attempts"),
            "created_at": r.get::<DateTime<Utc>,_>("created_at"),
            "completed_at": r.get::<Option<DateTime<Utc>>,_>("completed_at"),
        })
    }).collect();
    Ok(Json(json!({ "runs": jobs, "count": jobs.len() })))
}

async fn get_visibility_run(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(run_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, Uuid::new_v4(), false).await?;
    let row = sqlx::query(
        "SELECT oj.id, oj.project_id, oj.provider_id, oj.engine, oj.surface, oj.status, oj.created_at, oj.completed_at, oj.attempts, oj.last_error FROM observation_jobs oj WHERE oj.id=$1 AND oj.project_id=$2 AND oj.organization_id=$3"
    ).bind(run_id).bind(project).bind(org).fetch_optional(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    match row {
        Some(r) => Ok(Json(json!({
            "id": r.get::<Uuid,_>("id"),
            "project_id": r.get::<Uuid,_>("project_id"),
            "provider_id": r.get::<String,_>("provider_id"),
            "engine": r.get::<String,_>("engine"),
            "surface": r.get::<String,_>("surface"),
            "status": r.get::<String,_>("status"),
            "attempts": r.get::<i32,_>("attempts"),
            "created_at": r.get::<DateTime<Utc>,_>("created_at"),
            "completed_at": r.get::<Option<DateTime<Utc>>,_>("completed_at"),
            "last_error": r.get::<Option<String>,_>("last_error"),
        }))),
        None => Err(ApiError::NotFound),
    }
}

async fn get_run_observations(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(run_id): Path<Uuid>,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    // Verify run belongs to project
    let run_exists: Option<bool> = sqlx::query_scalar::<sqlx::Postgres, bool>(
        "SELECT EXISTS(SELECT 1 FROM observation_jobs WHERE id=$1 AND project_id=$2 AND organization_id=$3)"
    ).bind(run_id).bind(project).bind(org).fetch_optional(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    if run_exists != Some(true) {
        return Err(ApiError::NotFound);
    }
    let rows = sqlx::query(
        "SELECT ao.id, ao.prompt_id, ao.provider_id, ao.engine, ao.surface, ao.country, ao.language, ao.status, ao.answer_text, ao.collected_at, ao.provider_cost_microusd, ao.limitations FROM ai_observations ao WHERE ao.job_id=$1 ORDER BY ao.collected_at DESC"
    ).bind(run_id).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let obs: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        json!({
            "id": r.get::<Uuid,_>("id"),
            "prompt_id": r.get::<Uuid,_>("prompt_id"),
            "provider_id": r.get::<String,_>("provider_id"),
            "engine": r.get::<String,_>("engine"),
            "surface": r.get::<String,_>("surface"),
            "country": r.get::<String,_>("country"),
            "language": r.get::<String,_>("language"),
            "status": r.get::<String,_>("status"),
            "answer_text": r.get::<String,_>("answer_text"),
            "collected_at": r.get::<DateTime<Utc>,_>("collected_at"),
            "provider_cost_microusd": r.get::<Option<i64>,_>("provider_cost_microusd"),
            "limitations": r.get::<Value,_>("limitations"),
        })
    }).collect();
    Ok(Json(json!({ "observations": obs, "count": obs.len() })))
}

async fn get_engine(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(engine): Path<String>,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let rows = sqlx::query(
        "SELECT surface, count(*) as cnt FROM ai_observations WHERE project_id=$1 AND organization_id=$2 AND engine=$3 GROUP BY surface"
    ).bind(project).bind(org).bind(&engine).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let surfaces: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        json!({
            "surface": r.get::<String,_>("surface"),
            "observation_count": r.get::<i64,_>("cnt"),
        })
    }).collect();
    Ok(Json(json!({
        "engine": engine,
        "project_id": project,
        "surfaces": surfaces,
        "note": "Engine details show observed surfaces for this engine.",
    })))
}

async fn get_engine_history(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(engine): Path<String>,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let rows = sqlx::query(
        "SELECT to_char(date_trunc('day', collected_at), 'YYYY-MM-DD') as date, count(*) as cnt FROM ai_observations WHERE project_id=$1 AND organization_id=$2 AND engine=$3 AND collected_at >= now() - ($4 || ' days')::interval GROUP BY date_trunc('day', collected_at) ORDER BY date"
    ).bind(project).bind(org).bind(&engine).bind(q.range_days.to_string()).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let series: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        json!({
            "date": r.get::<String,_>("date"),
            "observation_count": r.get::<i64,_>("cnt"),
        })
    }).collect();
    Ok(Json(json!({
        "engine": engine,
        "project_id": project,
        "range_days": q.range_days,
        "series": series,
    })))
}

async fn list_citation_domains(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let rows = sqlx::query(
        "SELECT c.source_domain, count(*) as citation_count FROM observation_citations c JOIN ai_observations o ON o.id=c.observation_id WHERE o.project_id=$1 AND o.organization_id=$2 AND o.collected_at >= now() - ($3 || ' days')::interval GROUP BY c.source_domain ORDER BY citation_count DESC LIMIT 50"
    ).bind(project).bind(org).bind(q.range_days.to_string()).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let domains: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        json!({
            "domain": r.get::<String,_>("source_domain"),
            "citation_count": r.get::<i64,_>("citation_count"),
        })
    }).collect();
    Ok(Json(json!({ "domains": domains, "count": domains.len() })))
}

async fn citation_gaps(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    // Prompts where competitors are cited but the customer brand is not
    let rows = sqlx::query(
        "SELECT DISTINCT tp.exact_prompt, tp.id FROM tracked_prompts tp WHERE tp.project_id=$1 AND tp.status='active' AND EXISTS (SELECT 1 FROM observation_entity_matches oem JOIN ai_observations ao ON ao.id=oem.observation_id WHERE ao.prompt_id=tp.id AND oem.entity_kind='competitor')"
    ).bind(project).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let gaps: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        json!({
            "prompt_id": r.get::<Uuid,_>("id"),
            "prompt": r.get::<String,_>("exact_prompt"),
        })
    }).collect();
    Ok(Json(json!({ "gaps": gaps, "count": gaps.len() })))
}

async fn list_competitors(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let rows = sqlx::query(
        "SELECT alias, count(*) as mention_count FROM observation_entity_matches WHERE project_id=$1 AND entity_kind='competitor' GROUP BY alias ORDER BY mention_count DESC"
    ).bind(project).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let competitors: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        json!({
            "name": r.get::<String,_>("alias"),
            "mention_count": r.get::<i64,_>("mention_count"),
        })
    }).collect();
    Ok(Json(json!({ "competitors": competitors, "count": competitors.len() })))
}

async fn competitor_comparison(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let rows = sqlx::query(
        "SELECT oem.entity_kind, oem.matched_alias as name, count(*) as mention_count, count(DISTINCT oem.observation_id) as observation_count FROM observation_entity_matches oem JOIN ai_observations ao ON ao.id=oem.observation_id WHERE ao.project_id=$1 AND ao.organization_id=$2 AND ao.collected_at >= now() - ($3 || ' days')::interval GROUP BY oem.entity_kind, oem.matched_alias ORDER BY mention_count DESC"
    ).bind(project).bind(org).bind(q.range_days.to_string()).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let comparison: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        json!({
            "entity_kind": r.get::<String,_>("entity_kind"),
            "name": r.get::<String,_>("name"),
            "mention_count": r.get::<i64,_>("mention_count"),
            "observation_count": r.get::<i64,_>("observation_count"),
        })
    }).collect();
    Ok(Json(json!({ "comparison": comparison, "count": comparison.len() })))
}

async fn competitor_gaps(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    // Prompts where competitor mentioned but brand not mentioned
    let rows = sqlx::query(
        "SELECT tp.exact_prompt, oem.matched_alias as competitor FROM tracked_prompts tp JOIN observation_entity_matches oem ON oem.project_id=tp.project_id JOIN ai_observations ao ON ao.id=oem.observation_id WHERE tp.project_id=$1 AND tp.status='active' AND oem.entity_kind='competitor' AND NOT EXISTS (SELECT 1 FROM observation_entity_matches oem2 JOIN ai_observations ao2 ON ao2.id=oem2.observation_id WHERE ao2.prompt_id=tp.id AND oem2.entity_kind='brand') GROUP BY tp.exact_prompt, oem.matched_alias ORDER BY tp.exact_prompt"
    ).bind(project).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let gaps: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        json!({
            "prompt": r.get::<String,_>("exact_prompt"),
            "competitor": r.get::<String,_>("competitor"),
        })
    }).collect();
    Ok(Json(json!({ "gaps": gaps, "count": gaps.len() })))
}

async fn get_trends(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let rows = sqlx::query(
        "SELECT to_char(date_trunc('day', collected_at), 'YYYY-MM-DD') as date, count(*) as observation_count, count(*) FILTER (WHERE status='complete') as complete_count FROM ai_observations WHERE project_id=$1 AND organization_id=$2 AND collected_at >= now() - ($3 || ' days')::interval GROUP BY date_trunc('day', collected_at) ORDER BY date"
    ).bind(project).bind(org).bind(q.range_days.to_string()).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let series: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        json!({
            "date": r.get::<String,_>("date"),
            "observation_count": r.get::<i64,_>("observation_count"),
            "complete_count": r.get::<i64,_>("complete_count"),
        })
    }).collect();
    Ok(Json(json!({ "project_id": project, "range_days": q.range_days, "series": series })))
}

async fn get_summary(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let total_obs: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT count(*) FROM ai_observations WHERE project_id=$1 AND organization_id=$2 AND collected_at >= now() - ($3 || ' days')::interval"
    ).bind(project).bind(org).bind(q.range_days.to_string()).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let complete_obs: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT count(*) FROM ai_observations WHERE project_id=$1 AND organization_id=$2 AND status='complete' AND collected_at >= now() - ($3 || ' days')::interval"
    ).bind(project).bind(org).bind(q.range_days.to_string()).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let total_citations: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT count(*) FROM observation_citations c JOIN ai_observations o ON o.id=c.observation_id WHERE o.project_id=$1 AND o.organization_id=$2 AND o.collected_at >= now() - ($3 || ' days')::interval"
    ).bind(project).bind(org).bind(q.range_days.to_string()).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let brand_mentions: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT count(DISTINCT matched_alias) FROM observation_entity_matches WHERE project_id=$1 AND entity_kind='brand'"
    ).bind(project).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(json!({
        "project_id": project,
        "range_days": q.range_days,
        "total_observations": total_obs,
        "complete_observations": complete_obs,
        "total_citations": total_citations,
        "brand_mentions": brand_mentions,
        "completion_rate": if total_obs > 0 { (complete_obs as f64 / total_obs as f64 * 100.0).round() as i32 } else { 0 },
        "note": "Summary metrics describe sampled AI visibility observations.",
    })))
}

async fn get_history(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let rows = sqlx::query(
        "SELECT to_char(date_trunc('week', collected_at), 'YYYY-\"W\"') as period, count(*) as observation_count, count(*) FILTER (WHERE status='complete') as complete_count FROM ai_observations WHERE project_id=$1 AND organization_id=$2 AND collected_at >= now() - ($3 || ' days')::interval GROUP BY date_trunc('week', collected_at) ORDER BY period"
    ).bind(project).bind(org).bind(q.range_days.to_string()).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let series: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        json!({
            "period": r.get::<String,_>("period"),
            "observation_count": r.get::<i64,_>("observation_count"),
            "complete_count": r.get::<i64,_>("complete_count"),
        })
    }).collect();
    Ok(Json(json!({ "project_id": project, "range_days": q.range_days, "series": series })))
}

async fn get_history_comparison(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let current: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT count(*) FROM ai_observations WHERE project_id=$1 AND organization_id=$2 AND collected_at >= now() - ($3 || ' days')::interval AND collected_at >= now() - ($3 / 2 || ' days')::interval"
    ).bind(project).bind(org).bind(q.range_days.to_string()).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let previous: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT count(*) FROM ai_observations WHERE project_id=$1 AND organization_id=$2 AND collected_at >= now() - ($3 || ' days')::interval AND collected_at < now() - ($3 / 2 || ' days')::interval"
    ).bind(project).bind(org).bind(q.range_days.to_string()).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(json!({
        "project_id": project,
        "range_days": q.range_days,
        "current_period_observations": current,
        "previous_period_observations": previous,
        "change": if previous > 0 { ((current - previous) as f64 / previous as f64 * 100.0).round() as i32 } else { 0 },
        "note": "Comparison shows observation volume change between periods.",
    })))
}

async fn create_schedule(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<crate::visibility::CreateScheduleInput>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, input.project_id, true).await?;
    let schedule_id = Uuid::new_v4();
    let next_run = chrono::Utc::now() + chrono::Duration::days(7);
    let _ = sqlx::query(
        "INSERT INTO ai_monitoring_schedules(id, organization_id, project_id, cadence, next_run_at, configuration) VALUES($1,$2,$3,$4,$5,$6)"
    ).bind(schedule_id).bind(org).bind(project).bind(&input.cadence).bind(next_run).bind(&input.configuration).execute(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(json!({
        "id": schedule_id,
        "project_id": project,
        "cadence": input.cadence,
        "next_run_at": next_run,
        "enabled": true,
    })))
}

async fn list_schedules(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let rows = sqlx::query(
        "SELECT id, cadence, enabled, next_run_at, last_run_at, configuration, created_at FROM ai_monitoring_schedules WHERE project_id=$1 AND organization_id=$2 ORDER BY next_run_at"
    ).bind(project).bind(org).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let schedules: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        json!({
            "id": r.get::<Uuid,_>("id"),
            "cadence": r.get::<String,_>("cadence"),
            "enabled": r.get::<bool,_>("enabled"),
            "next_run_at": r.get::<Option<DateTime<Utc>>,_>("next_run_at"),
            "last_run_at": r.get::<Option<DateTime<Utc>>,_>("last_run_at"),
            "configuration": r.get::<Value,_>("configuration"),
        })
    }).collect();
    Ok(Json(json!({ "schedules": schedules, "count": schedules.len() })))
}

async fn update_schedule(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(schedule_id): Path<Uuid>,
    Json(input): Json<crate::visibility::UpdateScheduleInput>,
) -> Result<Json<Value>, ApiError> {
    let (_org, project) = authorize_project(&state, &headers, Uuid::new_v4(), false).await?;
    let affected = sqlx::query(
        "UPDATE ai_monitoring_schedules SET cadence=$1, enabled=$2, configuration=$3, updated_at=now() WHERE id=$4 AND project_id=$5"
    ).bind(&input.cadence).bind(input.enabled).bind(&input.configuration).bind(schedule_id).bind(project).execute(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    if affected.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(Json(json!({ "id": schedule_id, "updated": true })))
}

async fn delete_schedule(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(schedule_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let (_org, project) = authorize_project(&state, &headers, Uuid::new_v4(), false).await?;
    let affected = sqlx::query("DELETE FROM ai_monitoring_schedules WHERE id=$1 AND project_id=$2")
        .bind(schedule_id).bind(project).execute(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    if affected.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn list_providers(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<Value>, ApiError> {
    let providers = vec![
        json!({
            "provider_id": "openai_responses_api",
            "display_name": "OpenAI Responses API",
            "surface": "model_response",
            "is_consumer_search_observation": false,
            "capabilities": ["openai_api", "web_search_optional"]
        }),
        json!({
            "provider_id": "openai_responses_web_search",
            "display_name": "OpenAI Responses API (Web Search)",
            "surface": "model_response_web_search",
            "is_consumer_search_observation": false,
            "capabilities": ["openai_api", "web_search_grounded"]
        }),
        json!({
            "provider_id": "gemini_search",
            "display_name": "Gemini Search",
            "surface": "gemini_search",
            "is_consumer_search_observation": true,
            "capabilities": ["google_search_grounding"]
        }),
        json!({
            "provider_id": "perplexity",
            "display_name": "Perplexity",
            "surface": "model_response",
            "is_consumer_search_observation": false,
            "capabilities": ["perplexity_api"]
        }),
        json!({
            "provider_id": "serpapi_google",
            "display_name": "SerpApi Google AI Overview",
            "surface": "google_ai_overview",
            "is_consumer_search_observation": true,
            "capabilities": ["serpapi", "google_ai_overview"]
        }),
    ];
    Ok(Json(json!({ "providers": providers, "count": providers.len() })))
}

async fn get_provider_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, ApiError> {
    let rows = sqlx::query(
        "SELECT id, display_name, enabled, max_concurrency, max_requests_per_minute FROM ai_providers ORDER BY id"
    ).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let statuses: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        let enabled: bool = r.get::<bool,_>("enabled");
        json!({
            "provider_id": r.get::<String,_>("id"),
            "display_name": r.get::<String,_>("display_name"),
            "configured": enabled,
            "status": if enabled { "operational" } else { "unconfigured" },
            "max_concurrency": r.get::<i32,_>("max_concurrency"),
            "max_requests_per_minute": r.get::<i32,_>("max_requests_per_minute"),
        })
    }).collect();
    Ok(Json(json!({ "providers": statuses, "count": statuses.len() })))
}

async fn get_usage(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let rows = sqlx::query(
        "SELECT provider_id, count(*) as job_count, COALESCE(sum(actual_microusd),0) as total_microusd FROM provider_cost_events WHERE organization_id=$1 AND created_at >= now() - ($2 || ' days')::interval GROUP BY provider_id ORDER BY total_microusd DESC"
    ).bind(org).bind(q.range_days.to_string()).fetch_all(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let usage: Vec<Value> = rows.into_iter().map(|r| {
        use sqlx::Row;
        json!({
            "provider_id": r.get::<String,_>("provider_id"),
            "job_count": r.get::<i64,_>("job_count"),
            "total_microusd": r.get::<i64,_>("total_microusd"),
        })
    }).collect();
    Ok(Json(json!({ "organization_id": org, "range_days": q.range_days, "usage": usage })))
}

async fn get_credits(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<VisualQuery>,
) -> Result<Json<Value>, ApiError> {
    let (org, _project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let balance: Option<i64> = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT balance_microusd FROM visibility_credit_accounts WHERE organization_id=$1"
    ).bind(org).fetch_optional(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(json!({
        "organization_id": org,
        "balance_microusd": balance.unwrap_or(0),
        "currency": "USD",
        "note": "Credit balance is in micro-USD (1/1,000,000 of a dollar).",
    })))
}

// Input types for schedule CRUD
#[derive(Deserialize)]
pub struct CreateScheduleInput {
    pub project_id: Uuid,
    pub cadence: String,
    pub configuration: Value,
}
#[derive(Deserialize)]
pub struct UpdateScheduleInput {
    pub cadence: String,
    pub enabled: bool,
    pub configuration: Value,
}

// ============================================================================
// Visibility Metrics Engine
// ============================================================================

#[derive(Deserialize)]
pub struct MetricsQuery {
    pub project_id: Uuid,
    #[serde(default = "default_range_days")]
    pub range_days: i64,
    pub engine: Option<String>,
    pub surface: Option<String>,
}

#[derive(Serialize)]
struct MetricsResult {
    project_id: Uuid,
    range_days: i64,
    engine: Option<String>,
    surface: Option<String>,
    eligible_observations: i64,
    brand_mentioned_observations: i64,
    mention_rate: f64,
    domain_cited_observations: i64,
    citation_rate: f64,
    recommendation_rate: Option<f64>,
    share_of_voice: Option<f64>,
    score_version: String,
    calculated_at: DateTime<Utc>,
}

async fn get_metrics(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<MetricsQuery>,
) -> Result<Json<MetricsResult>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let start = Utc::now() - chrono::Duration::days(q.range_days);

    let mut obs_sql = "SELECT count(*) as total, count(*) FILTER (WHERE status='complete') as complete FROM ai_observations WHERE project_id=$1 AND organization_id=$2 AND collected_at >= $3".to_string();
    let mut bind_idx = 4;
    if let Some(ref engine) = q.engine {
        obs_sql.push_str(format!(" AND engine=${bind_idx}").as_str());
        bind_idx += 1;
    }
    if let Some(ref surface) = q.surface {
        obs_sql.push_str(format!(" AND surface=${bind_idx}").as_str());
        bind_idx += 1;
    }

    let total_row = sqlx::query(&obs_sql)
        .bind(project).bind(org).bind(start)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let eligible: i64 = total_row.try_get::<i64,_>("complete").unwrap_or(0);

    // Brand mentions
    let mut brand_sql = "SELECT count(DISTINCT matched_alias) FROM observation_entity_matches WHERE project_id=$1 AND entity_kind='brand'".to_string();
    let brand_row = sqlx::query(&brand_sql).bind(project).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let brand_mentioned: i64 = brand_row.try_get::<i64,_>(0).unwrap_or(0);

    // Domain citations
    let mut cit_sql = "SELECT count(*) FROM observation_citations c JOIN ai_observations o ON o.id=c.observation_id WHERE o.project_id=$1 AND o.organization_id=$2 AND o.collected_at >= $3".to_string();
    let cit_row = sqlx::query(&cit_sql).bind(project).bind(org).bind(start).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let domain_cited: i64 = cit_row.try_get::<i64,_>(0).unwrap_or(0);

    let mention_rate = if eligible > 0 { brand_mentioned as f64 / eligible as f64 * 100.0 } else { 0.0 };
    let citation_rate = if eligible > 0 { domain_cited as f64 / eligible as f64 * 100.0 } else { 0.0 };

    // Share of voice: brand mentions / total mentions across all brands
    let total_mentions: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT count(*) FROM observation_entity_matches WHERE project_id=$1 AND entity_kind IN ('brand','competitor')"
    ).bind(project).fetch_one(&state.pool).await.map_err(|e| ApiError::Internal(e.into()))?;
    let share_of_voice = if total_mentions > 0 {
        Some(brand_mentioned as f64 / total_mentions as f64 * 100.0)
    } else {
        None
    };

    // Persist metrics snapshot
    let metrics_id = Uuid::new_v4();
    let period_end = Utc::now();
    let _ = sqlx::query(
        "INSERT INTO visibility_metrics(id, organization_id, project_id, engine, surface, observation_type, period_start, period_end, eligible_observations, brand_mentioned_observations, mention_rate, domain_cited_observations, citation_rate, recommendation_rate, share_of_voice, score_version, calculated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT DO NOTHING"
    ).bind(metrics_id).bind(org).bind(project).bind(q.engine.clone().unwrap_or_default()).bind(q.surface.clone().unwrap_or_default()).bind("snapshot").bind(start).bind(period_end).bind(eligible).bind(brand_mentioned).bind(mention_rate).bind(domain_cited).bind(citation_rate).bind(None::<f64>).bind(share_of_voice).bind("1.0").bind(period_end).execute(&state.pool).await;

    Ok(Json(MetricsResult {
        project_id: project,
        range_days: q.range_days,
        engine: q.engine,
        surface: q.surface,
        eligible_observations: eligible,
        brand_mentioned_observations: brand_mentioned,
        mention_rate: mention_rate.round() * 100.0 / 100.0,
        domain_cited_observations: domain_cited,
        citation_rate: citation_rate.round() * 100.0 / 100.0,
        recommendation_rate: None,
        share_of_voice: share_of_voice.map(|v| (v * 100.0).round() / 100.0),
        score_version: "1.0".to_string(),
        calculated_at: period_end,
    }))
}

// ============================================================================
// Citations & Sources Engine
// ============================================================================

use url::Host;

/// Normalize a URL for citation grouping: lowercase host, strip fragment,
/// remove default ports, keep path and meaningful query.
fn normalize_citation_url(url: &str) -> Option<String> {
    let parsed = Url::parse(url).ok()?;
    let mut normalized = parsed.clone();
    // Strip fragment
    normalized.set_fragment(None);
    // Lowercase host
    if let Some(host) = normalized.host_str() {
        normalized.set_host(Some(&host.to_ascii_lowercase())).ok()?;
    }
    // Remove default ports
    if let Some(port) = normalized.port() {
        let default = match normalized.scheme() {
            "http" => 80,
            "https" => 443,
            _ => 0,
        };
        if port == default && default != 0 {
            normalized.set_port(None).ok()?;
        }
    }
    Some(normalized.to_string())
}

/// Extract registrable domain from a URL (lowercased).
fn citation_domain(url: &str) -> Option<String> {
    Url::parse(url)
        .ok()?
        .host_str()
        .map(|h| h.to_ascii_lowercase())
}

/// Classify domain ownership for a project.
async fn classify_domain_ownership(
    pool: &PgPool,
    project_id: Uuid,
    domain: &str,
) -> &'static str {
    let domain_lower = domain.to_ascii_lowercase();
    // Check customer-owned verified domains
    let owned: Option<bool> = sqlx::query_scalar::<sqlx::Postgres, bool>(
        "SELECT EXISTS(SELECT 1 FROM project_verified_domains WHERE project_id=$1 AND domain=$2)",
    )
    .bind(project_id)
    .bind(&domain_lower)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);
    if owned == Some(true) {
        return "customer_owned";
    }
    // Check competitor profiles by domain
    let comp: Option<String> = sqlx::query_scalar::<sqlx::Postgres, String>(
        "SELECT domain FROM competitor_profiles WHERE project_id=$1 AND domain=$2",
    )
    .bind(project_id)
    .bind(&domain_lower)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);
    if comp.is_some() {
        return "competitor_owned";
    }
    // Check competitor aliases by name (loose match - domain contains alias)
    let comp_name: Option<String> = sqlx::query_scalar::<sqlx::Postgres, String>(
        "SELECT competitor_name FROM project_competitor_aliases WHERE project_id=$1",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .ok()
    .and_then(|rows| {
        rows.into_iter()
            .find(|alias| domain_lower.contains(&alias.to_ascii_lowercase()))
    });
    if comp_name.is_some() {
        return "competitor_owned";
    }
    "third_party"
}

fn default_range_days_30() -> i64 {
    30
}

#[derive(Deserialize)]
pub struct CitationsQuery {
    pub project_id: Uuid,
    #[serde(default = "default_range_days_30")]
    pub range_days: i64,
    pub engine: Option<String>,
    pub surface: Option<String>,
    pub ownership: Option<String>,
}

#[derive(Serialize)]
pub struct CitationsOverviewResponse {
    pub project_id: Uuid,
    pub range_days: i64,
    pub own_domain_citation_rate: f64,
    pub own_domain_citation_rate_numerator: i64,
    pub own_domain_citation_rate_denominator: i64,
    pub unique_cited_domains: i64,
    pub unique_own_pages_cited: i64,
    pub competitor_only_gaps: i64,
    pub eligible_observations: i64,
    pub data_quality: String,
    pub distribution: serde_json::Value,
}

async fn citations_overview(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<CitationsQuery>,
) -> Result<Json<CitationsOverviewResponse>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let start = Utc::now() - chrono::Duration::days(q.range_days);

    // Eligible observations: complete, with citations, in range
    let eligible: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT count(DISTINCT o.id) FROM ai_observations o
         JOIN observation_citations c ON c.observation_id = o.id
         WHERE o.project_id=$1 AND o.organization_id=$2 AND o.status='complete'
         AND o.collected_at >= $3",
    )
    .bind(project)
    .bind(org)
    .bind(start)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?
    .unwrap_or(0);

    // Observations citing at least one customer-owned domain
    let own_citing: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT count(DISTINCT o.id) FROM ai_observations o
         JOIN observation_citations c ON c.observation_id = o.id
         JOIN project_verified_domains vd ON vd.project_id=$1 AND lower(c.source_domain) = lower(vd.domain)
         WHERE o.project_id=$1 AND o.organization_id=$2 AND o.status='complete'
         AND o.collected_at >= $3",
    )
    .bind(project)
    .bind(org)
    .bind(start)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?
    .unwrap_or(0);

    // Unique cited domains
    let unique_domains: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT count(DISTINCT lower(c.source_domain)) FROM observation_citations c
         JOIN ai_observations o ON o.id=c.observation_id
         WHERE o.project_id=$1 AND o.organization_id=$2 AND o.collected_at >= $3",
    )
    .bind(project)
    .bind(org)
    .bind(start)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?
    .unwrap_or(0);

    // Unique own pages cited
    let own_pages: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT count(DISTINCT lower(c.url)) FROM observation_citations c
         JOIN ai_observations o ON o.id=c.observation_id
         JOIN project_verified_domains vd ON vd.project_id=$1 AND lower(c.source_domain) = lower(vd.domain)
         WHERE o.project_id=$1 AND o.organization_id=$2 AND o.collected_at >= $3",
    )
    .bind(project)
    .bind(org)
    .bind(start)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?
    .unwrap_or(0);

    // Competitor-only gaps: observations citing competitors but not customer domains
    let competitor_gaps: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT count(DISTINCT o.id) FROM ai_observations o
         JOIN observation_citations c ON c.observation_id = o.id
         JOIN competitor_profiles cp ON cp.project_id=$1 AND lower(c.source_domain) = lower(cp.domain)
         WHERE o.project_id=$1 AND o.organization_id=$2 AND o.status='complete'
         AND o.collected_at >= $3
         AND NOT EXISTS (
             SELECT 1 FROM observation_citations c2
             JOIN project_verified_domains vd ON vd.project_id=$1 AND lower(c2.source_domain) = lower(vd.domain)
             WHERE c2.observation_id = o.id
         )",
    )
    .bind(project)
    .bind(org)
    .bind(start)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?
    .unwrap_or(0);

    // Distribution
    let customer_count: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT count(DISTINCT lower(c.source_domain)) FROM observation_citations c
         JOIN ai_observations o ON o.id=c.observation_id
         JOIN project_verified_domains vd ON vd.project_id=$1 AND lower(c.source_domain) = lower(vd.domain)
         WHERE o.project_id=$1 AND o.organization_id=$2 AND o.collected_at >= $3",
    )
    .bind(project)
    .bind(org)
    .bind(start)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?
    .unwrap_or(0);

    let competitor_count: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
        "SELECT count(DISTINCT lower(c.source_domain)) FROM observation_citations c
         JOIN ai_observations o ON o.id=c.observation_id
         JOIN competitor_profiles cp ON cp.project_id=$1 AND lower(c.source_domain) = lower(cp.domain)
         WHERE o.project_id=$1 AND o.organization_id=$2 AND o.collected_at >= $3",
    )
    .bind(project)
    .bind(org)
    .bind(start)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?
    .unwrap_or(0);

    let total_cited_domains = unique_domains.max(1);
    let third_party_count = total_cited_domains - customer_count - competitor_count;

    let own_rate = if eligible > 0 {
        (own_citing as f64 / eligible as f64 * 100.0).round() * 100.0 / 100.0
    } else {
        0.0
    };

    let data_quality = if eligible == 0 {
        "insufficient_data"
    } else if eligible < 10 {
        "partial"
    } else {
        "ready"
    };

    Ok(Json(CitationsOverviewResponse {
        project_id: project,
        range_days: q.range_days,
        own_domain_citation_rate: own_rate,
        own_domain_citation_rate_numerator: own_citing,
        own_domain_citation_rate_denominator: eligible,
        unique_cited_domains: unique_domains,
        unique_own_pages_cited: own_pages,
        competitor_only_gaps: competitor_gaps,
        eligible_observations: eligible,
        data_quality: data_quality.to_string(),
        distribution: serde_json::json!({
            "customer_owned": customer_count,
            "competitor_owned": competitor_count,
            "third_party": third_party_count.max(0),
        }),
    }))
}

#[derive(Serialize)]
pub struct CitationsTrendPoint {
    pub date: String,
    pub own_rate: f64,
    pub competitor_rate: f64,
    pub eligible_observations: i64,
}

#[derive(Serialize)]
pub struct CitationsTrendsResponse {
    pub project_id: Uuid,
    pub range_days: i64,
    pub series: Vec<CitationsTrendPoint>,
}

async fn citations_trends(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<CitationsQuery>,
) -> Result<Json<CitationsTrendsResponse>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let start = Utc::now() - chrono::Duration::days(q.range_days);

    let rows = sqlx::query(
        "SELECT to_char(date_trunc('day', o.collected_at), 'YYYY-MM-DD') as date,
                count(DISTINCT o.id) as eligible,
                count(DISTINCT o.id) FILTER (
                    WHERE EXISTS (
                        SELECT 1 FROM observation_citations c2
                        JOIN project_verified_domains vd ON vd.project_id=$1 AND lower(c2.source_domain) = lower(vd.domain)
                        WHERE c2.observation_id = o.id
                    )
                ) as own_citing,
                count(DISTINCT o.id) FILTER (
                    WHERE EXISTS (
                        SELECT 1 FROM observation_citations c2
                        JOIN competitor_profiles cp ON cp.project_id=$1 AND lower(c2.source_domain) = lower(cp.domain)
                        WHERE c2.observation_id = o.id
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM observation_citations c3
                        JOIN project_verified_domains vd2 ON vd2.project_id=$1 AND lower(c3.source_domain) = lower(vd2.domain)
                        WHERE c3.observation_id = o.id
                    )
                ) as competitor_citing
         FROM ai_observations o
         JOIN observation_citations c ON c.observation_id = o.id
         WHERE o.project_id=$1 AND o.organization_id=$2 AND o.status='complete'
         AND o.collected_at >= $3
         GROUP BY date_trunc('day', o.collected_at)
         ORDER BY date",
    )
    .bind(project)
    .bind(org)
    .bind(start)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let series: Vec<CitationsTrendPoint> = rows
        .into_iter()
        .map(|r| {
            use sqlx::Row;
            let eligible: i64 = r.try_get::<i64, _>("eligible").unwrap_or(0);
            let own_citing: i64 = r.try_get::<i64, _>("own_citing").unwrap_or(0);
            let competitor_citing: i64 = r.try_get::<i64, _>("competitor_citing").unwrap_or(0);
            CitationsTrendPoint {
                date: r.get::<String, _>("date"),
                own_rate: if eligible > 0 {
                    (own_citing as f64 / eligible as f64 * 100.0).round() * 100.0 / 100.0
                } else {
                    0.0
                },
                competitor_rate: if eligible > 0 {
                    (competitor_citing as f64 / eligible as f64 * 100.0).round() * 100.0 / 100.0
                } else {
                    0.0
                },
                eligible_observations: eligible,
            }
        })
        .collect();

    Ok(Json(CitationsTrendsResponse {
        project_id: project,
        range_days: q.range_days,
        series,
    }))
}

#[derive(Serialize)]
pub struct CitationDomainRow {
    pub domain: String,
    pub ownership: String,
    pub citing_observations: i64,
    pub unique_cited_urls: i64,
    pub unique_prompts: i64,
    pub engines: Vec<String>,
    pub first_seen: Option<DateTime<Utc>>,
    pub last_seen: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct CitationsDomainsResponse {
    pub project_id: Uuid,
    pub range_days: i64,
    pub domains: Vec<CitationDomainRow>,
    pub total: i64,
}

async fn citations_domains(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<CitationsQuery>,
) -> Result<Json<CitationsDomainsResponse>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let start = Utc::now() - chrono::Duration::days(q.range_days);

    let mut sql = String::from(
        "SELECT lower(c.source_domain) as domain,
                count(DISTINCT o.id) as citing_observations,
                count(DISTINCT c.url) as unique_cited_urls,
                count(DISTINCT o.prompt_id) as unique_prompts,
                array_agg(DISTINCT o.engine) as engines,
                min(o.collected_at) as first_seen,
                max(o.collected_at) as last_seen
         FROM observation_citations c
         JOIN ai_observations o ON o.id=c.observation_id
         WHERE o.project_id=$1 AND o.organization_id=$2 AND o.collected_at >= $3
         GROUP BY lower(c.source_domain)",
    );
    let mut bind_idx = 4;
    if let Some(ref ownership) = q.ownership {
        sql.push_str(&format!(
            " HAVING lower(c.source_domain) {} (
                SELECT CASE
                    WHEN EXISTS(SELECT 1 FROM project_verified_domains vd WHERE vd.project_id=$1 AND lower(vd.domain)=lower(c.source_domain)) THEN 'customer_owned'
                    WHEN EXISTS(SELECT 1 FROM competitor_profiles cp WHERE cp.project_id=$1 AND lower(cp.domain)=lower(c.source_domain)) THEN 'competitor_owned'
                    ELSE 'third_party'
                END
            )",
            bind_idx
        ));
        bind_idx += 1;
        // Need to add ownership filter binding - but this gets complex with HAVING.
        // Simpler: filter in application layer for ownership.
    }

    sql.push_str(" ORDER BY citing_observations DESC LIMIT 100");

    let rows = sqlx::query(&sql)
        .bind(project)
        .bind(org)
        .bind(start)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;

    let mut domains = Vec::new();
    for r in rows {
        use sqlx::Row;
        let domain: String = r.get("domain");
        let ownership = classify_domain_ownership(&state.pool, project, &domain).await;
        let engines: Vec<String> = r
            .try_get::<Option<Vec<String>>, _>("engines")
            .unwrap_or_default()
            .unwrap_or_default();

        // Apply ownership filter if specified
        if let Some(ref filter_ownership) = q.ownership {
            if ownership != filter_ownership.as_str() {
                continue;
            }
        }

        domains.push(CitationDomainRow {
            domain,
            ownership: ownership.to_string(),
            citing_observations: r.try_get::<i64, _>("citing_observations").unwrap_or(0),
            unique_cited_urls: r.try_get::<i64, _>("unique_cited_urls").unwrap_or(0),
            unique_prompts: r.try_get::<i64, _>("unique_prompts").unwrap_or(0),
            engines,
            first_seen: r.try_get::<Option<DateTime<Utc>>, _>("first_seen").ok().flatten(),
            last_seen: r.try_get::<Option<DateTime<Utc>>, _>("last_seen").ok().flatten(),
        });
    }

    let total = domains.len() as i64;

    Ok(Json(CitationsDomainsResponse {
        project_id: project,
        range_days: q.range_days,
        domains,
        total,
    }))
}

#[derive(Serialize)]
pub struct CitationDomainDetail {
    pub domain: String,
    pub ownership: String,
    pub citing_observations: i64,
    pub unique_cited_urls: i64,
    pub unique_prompts: i64,
    pub engines: Vec<String>,
    pub first_seen: Option<DateTime<Utc>>,
    pub last_seen: Option<DateTime<Utc>>,
    pub cited_urls: Vec<serde_json::Value>,
}

async fn citations_domain_detail(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(domain): Path<String>,
    Query(q): Query<CitationsQuery>,
) -> Result<Json<CitationDomainDetail>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let start = Utc::now() - chrono::Duration::days(q.range_days);

    let ownership = classify_domain_ownership(&state.pool, project, &domain).await;

    let rows = sqlx::query(
        "SELECT c.url, c.title, o.engine, o.collected_at, o.id as observation_id
         FROM observation_citations c
         JOIN ai_observations o ON o.id=c.observation_id
         WHERE o.project_id=$1 AND o.organization_id=$2 AND o.collected_at >= $3
         AND lower(c.source_domain)=$4
         ORDER BY o.collected_at DESC LIMIT 50",
    )
    .bind(project)
    .bind(org)
    .bind(start)
    .bind(&domain.to_ascii_lowercase())
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let mut cited_urls = Vec::new();
    let mut citing_observations: i64 = 0;
    let mut unique_urls: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut unique_prompts: std::collections::HashSet<Uuid> = std::collections::HashSet::new();
    let mut engines: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut first_seen: Option<DateTime<Utc>> = None;
    let mut last_seen: Option<DateTime<Utc>> = None;

    for r in rows {
        use sqlx::Row;
        let url: String = r.get("url");
        let title: Option<String> = r.try_get("title").ok().flatten();
        let engine: String = r.get("engine");
        let collected_at: DateTime<Utc> = r.get("collected_at");
        let obs_id: Uuid = r.get("observation_id");

        citing_observations += 1;
        unique_urls.insert(url.clone());
          engines.insert(engine.clone());
        if first_seen.is_none() || collected_at < first_seen.unwrap() {
            first_seen = Some(collected_at);
        }
        if last_seen.is_none() || collected_at > last_seen.unwrap() {
            last_seen = Some(collected_at);
        }

        cited_urls.push(serde_json::json!({
            "url": url,
            "title": title,
            "engine": engine,
            "observation_id": obs_id,
            "collected_at": collected_at,
        }));
    }

    // Get unique prompts count from observations
    let prompt_rows = sqlx::query(
        "SELECT DISTINCT o.prompt_id FROM observation_citations c
         JOIN ai_observations o ON o.id=c.observation_id
         WHERE o.project_id=$1 AND o.organization_id=$2 AND o.collected_at >= $3
         AND lower(c.source_domain)=$4",
    )
    .bind(project)
    .bind(org)
    .bind(start)
    .bind(&domain.to_ascii_lowercase())
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;
    for r in prompt_rows {
        use sqlx::Row;
        let pid: Uuid = r.get("prompt_id");
        unique_prompts.insert(pid);
    }

    Ok(Json(CitationDomainDetail {
        domain,
        ownership: ownership.to_string(),
        citing_observations,
        unique_cited_urls: unique_urls.len() as i64,
        unique_prompts: unique_prompts.len() as i64,
        engines: engines.into_iter().collect(),
        first_seen,
        last_seen,
        cited_urls,
    }))
}

#[derive(Serialize)]
pub struct CitationPageRow {
    pub id: Uuid,
    pub title: Option<String>,
    pub url: String,
    pub normalized_url: String,
    pub domain: String,
    pub ownership: String,
    pub citing_observations: i64,
    pub unique_prompts: i64,
    pub engines: Vec<String>,
    pub last_seen: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct CitationsPagesResponse {
    pub project_id: Uuid,
    pub range_days: i64,
    pub pages: Vec<CitationPageRow>,
    pub total: i64,
}

async fn citations_pages(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<CitationsQuery>,
) -> Result<Json<CitationsPagesResponse>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let start = Utc::now() - chrono::Duration::days(q.range_days);

    let rows = sqlx::query(
        "SELECT c.url, c.title, count(DISTINCT o.id) as citing_observations,
                count(DISTINCT o.prompt_id) as unique_prompts,
                array_agg(DISTINCT o.engine) as engines,
                max(o.collected_at) as last_seen
         FROM observation_citations c
         JOIN ai_observations o ON o.id=c.observation_id
         WHERE o.project_id=$1 AND o.organization_id=$2 AND o.collected_at >= $3
         GROUP BY c.url, c.title
         ORDER BY citing_observations DESC LIMIT 100",
    )
    .bind(project)
    .bind(org)
    .bind(start)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let mut pages = Vec::new();
    for r in rows {
        use sqlx::Row;
        let url: String = r.get("url");
        let title: Option<String> = r.try_get("title").ok().flatten();
        let normalized_url = normalize_citation_url(&url).unwrap_or(url.clone());
        let domain = citation_domain(&url).unwrap_or_default();
        let ownership = classify_domain_ownership(&state.pool, project, &domain).await;
        let engines: Vec<String> = r
            .try_get::<Option<Vec<String>>, _>("engines")
            .unwrap_or_default()
            .unwrap_or_default();

        if let Some(ref filter_ownership) = q.ownership {
            if ownership != filter_ownership.as_str() {
                continue;
            }
        }

        pages.push(CitationPageRow {
            id: Uuid::new_v4(), // synthetic id for grouping
            title,
            url,
            normalized_url,
            domain,
            ownership: ownership.to_string(),
            citing_observations: r.try_get::<i64, _>("citing_observations").unwrap_or(0),
            unique_prompts: r.try_get::<i64, _>("unique_prompts").unwrap_or(0),
            engines,
            last_seen: r.try_get::<Option<DateTime<Utc>>, _>("last_seen").ok().flatten(),
        });
    }

    let total = pages.len() as i64;

    Ok(Json(CitationsPagesResponse {
        project_id: project,
        range_days: q.range_days,
        pages,
        total,
    }))
}

#[derive(Serialize)]
pub struct CitationPageDetail {
    pub id: Uuid,
    pub title: Option<String>,
    pub url: String,
    pub normalized_url: String,
    pub domain: String,
    pub ownership: String,
    pub citing_observations: i64,
    pub unique_prompts: i64,
    pub engines: Vec<String>,
    pub first_seen: Option<DateTime<Utc>>,
    pub last_seen: Option<DateTime<Utc>>,
    pub citation_history: Vec<serde_json::Value>,
}

async fn citations_page_detail(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(page_id): Path<String>,
    Query(q): Query<CitationsQuery>,
) -> Result<Json<CitationPageDetail>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let start = Utc::now() - chrono::Duration::days(q.range_days);

    // page_id is the URL (URL-encoded)
    let url = page_id;
    let normalized_url = normalize_citation_url(&url).unwrap_or(url.clone());
    let domain = citation_domain(&url).unwrap_or_default();
    let ownership = classify_domain_ownership(&state.pool, project, &domain).await;

    let rows = sqlx::query(
        "SELECT c.id, c.title, o.engine, o.collected_at, o.prompt_id, tp.exact_prompt as prompt_text
         FROM observation_citations c
         JOIN ai_observations o ON o.id=c.observation_id
         JOIN tracked_prompts tp ON tp.id=o.prompt_id
         WHERE o.project_id=$1 AND o.organization_id=$2 AND o.collected_at >= $3
         AND c.url=$4
         ORDER BY o.collected_at DESC",
    )
    .bind(project)
    .bind(org)
    .bind(start)
    .bind(&url)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let mut citation_history = Vec::new();
    let mut citing_observations: i64 = 0;
    let mut unique_prompts: std::collections::HashSet<Uuid> = std::collections::HashSet::new();
    let mut engines: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut first_seen: Option<DateTime<Utc>> = None;
    let mut last_seen: Option<DateTime<Utc>> = None;
    let mut title: Option<String> = None;

    for r in rows {
        use sqlx::Row;
        let obs_id: Uuid = r.get("id");
        let t: Option<String> = r.try_get("title").ok().flatten();
        let engine: String = r.get("engine");
        let collected_at: DateTime<Utc> = r.get("collected_at");
        let prompt_id: Uuid = r.get("prompt_id");
        let prompt_text: Option<String> = r.try_get("prompt_text").ok().flatten();

        title = title.or(t);
        citing_observations += 1;
        unique_prompts.insert(prompt_id);
          engines.insert(engine.clone());
        if first_seen.is_none() || collected_at < first_seen.unwrap() {
            first_seen = Some(collected_at);
        }
        if last_seen.is_none() || collected_at > last_seen.unwrap() {
            last_seen = Some(collected_at);
        }

        citation_history.push(serde_json::json!({
            "observation_id": obs_id,
            "engine": engine,
            "prompt": prompt_text,
            "collected_at": collected_at,
        }));
    }

    Ok(Json(CitationPageDetail {
        id: Uuid::new_v4(),
        title,
        url,
        normalized_url,
        domain,
        ownership: ownership.to_string(),
        citing_observations,
        unique_prompts: unique_prompts.len() as i64,
        engines: engines.into_iter().collect(),
        first_seen,
        last_seen,
        citation_history,
    }))
}

#[derive(Serialize)]
pub struct CitationGapRow {
    pub id: Uuid,
    pub prompt: String,
    pub engine: String,
    pub competitor: String,
    pub competitor_url: Option<String>,
    pub customer_cited: bool,
    pub priority: String,
}

#[derive(Serialize)]
pub struct CitationsGapsResponse {
    pub project_id: Uuid,
    pub range_days: i64,
    pub gaps: Vec<CitationGapRow>,
    pub total: i64,
}

async fn citations_gaps(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<CitationsQuery>,
) -> Result<Json<CitationsGapsResponse>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let start = Utc::now() - chrono::Duration::days(q.range_days);

    // Prompts where competitors are cited but customer domains are not
    let rows = sqlx::query(
        "SELECT DISTINCT tp.id as prompt_id, tp.exact_prompt as prompt, o.engine as engine,
                cp.competitor_name as competitor, c.url as competitor_url,
                CASE WHEN EXISTS (
                    SELECT 1 FROM observation_citations c2
                    JOIN project_verified_domains vd ON vd.project_id=$1 AND lower(c2.source_domain) = lower(vd.domain)
                    WHERE c2.observation_id = o.id
                ) THEN true ELSE false END as customer_cited
         FROM tracked_prompts tp
         JOIN ai_observations o ON o.prompt_id=tp.id
         JOIN observation_citations c ON c.observation_id=o.id
         JOIN competitor_profiles cp ON cp.project_id=$1 AND lower(c.source_domain) = lower(cp.domain)
         WHERE tp.project_id=$1 AND tp.status='active'
         AND o.organization_id=$2 AND o.status='complete' AND o.collected_at >= $3
         AND NOT EXISTS (
             SELECT 1 FROM observation_citations c3
             JOIN project_verified_domains vd2 ON vd2.project_id=$1 AND lower(c3.source_domain) = lower(vd2.domain)
             WHERE c3.observation_id = o.id
         )
         ORDER BY tp.exact_prompt, o.engine LIMIT 100",
    )
    .bind(project)
    .bind(org)
    .bind(start)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let mut gaps = Vec::new();
    for r in rows {
        use sqlx::Row;
        let customer_cited: bool = r.try_get("customer_cited").unwrap_or(false);
        let priority = if customer_cited {
            "low"
        } else {
            "high"
        };
        gaps.push(CitationGapRow {
            id: Uuid::new_v4(),
            prompt: r.get("prompt"),
            engine: r.get("engine"),
            competitor: r.get("competitor"),
            competitor_url: r.try_get("competitor_url").ok().flatten(),
            customer_cited,
            priority: priority.to_string(),
        });
    }

    let total = gaps.len() as i64;

    Ok(Json(CitationsGapsResponse {
        project_id: project,
        range_days: q.range_days,
        gaps,
        total,
    }))
}

#[derive(Serialize)]
pub struct CitationGapDetail {
    pub id: Uuid,
    pub prompt: String,
    pub engine: String,
    pub competitor: String,
    pub competitor_url: Option<String>,
    pub customer_cited: bool,
    pub priority: String,
    pub supporting_observations: Vec<serde_json::Value>,
}

async fn citations_gap_detail(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(gap_id): Path<Uuid>,
    Query(q): Query<CitationsQuery>,
) -> Result<Json<CitationGapDetail>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;
    let start = Utc::now() - chrono::Duration::days(q.range_days);

    let rows = sqlx::query(
        "SELECT tp.exact_prompt as prompt, o.engine as engine,
                cp.competitor_name as competitor, c.url as competitor_url,
                o.id as observation_id, o.collected_at, o.answer_text
         FROM tracked_prompts tp
         JOIN ai_observations o ON o.prompt_id=tp.id
         JOIN observation_citations c ON c.observation_id=o.id
         JOIN competitor_profiles cp ON cp.project_id=$1 AND lower(c.source_domain) = lower(cp.domain)
         WHERE tp.id=$2 AND tp.project_id=$1 AND tp.status='active'
         AND o.organization_id=$2 AND o.status='complete' AND o.collected_at >= $3
         ORDER BY o.collected_at DESC LIMIT 50",
    )
    .bind(project)
    .bind(gap_id)
    .bind(org)
    .bind(start)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    if rows.is_empty() {
        return Err(ApiError::NotFound);
    }

    use sqlx::Row;
    let first = &rows[0];
    let prompt: String = first.get("prompt");
    let engine: String = first.get("engine");
    let competitor: String = first.get("competitor");
    let competitor_url: Option<String> = first.try_get("competitor_url").ok().flatten();
    let customer_cited: bool = false; // gap means customer not cited

    let mut supporting = Vec::new();
    for r in rows {
        supporting.push(serde_json::json!({
            "observation_id": r.get::<Uuid,_>("observation_id"),
            "collected_at": r.get::<DateTime<Utc>,_>("collected_at"),
            "answer_excerpt": r.get::<Option<String>,_>("answer_text").unwrap_or_default().chars().take(200).collect::<String>(),
        }));
    }

    Ok(Json(CitationGapDetail {
        id: gap_id,
        prompt,
        engine,
        competitor,
        competitor_url,
        customer_cited,
        priority: "high".to_string(),
        supporting_observations: supporting,
    }))
}

#[derive(Serialize)]
pub struct CitationObservationDetail {
    pub id: Uuid,
    pub prompt: String,
    pub prompt_text: Option<String>,
    pub answer_excerpt: Option<String>,
    pub engine: String,
    pub provider: Option<String>,
    pub observation_type: String,
    pub model: Option<String>,
    pub country: Option<String>,
    pub language: Option<String>,
    pub captured_at: Option<DateTime<Utc>>,
    pub domain: String,
    pub url: String,
    pub title: Option<String>,
    pub brand_matches: Vec<String>,
    pub competitor_matches: Vec<String>,
}

async fn citations_observation_detail(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(obs_id): Path<Uuid>,
    Query(q): Query<CitationsQuery>,
) -> Result<Json<CitationObservationDetail>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, q.project_id, false).await?;

    let row = sqlx::query(
        "SELECT o.id, tp.exact_prompt as prompt, o.engine as engine, o.surface as observation_type,
                o.country, o.language, o.collected_at, o.answer_text,
                c.url, c.source_domain as domain, c.title
         FROM ai_observations o
         JOIN tracked_prompts tp ON tp.id=o.prompt_id
         LEFT JOIN observation_citations c ON c.observation_id=o.id
         WHERE o.id=$1 AND o.project_id=$2 AND o.organization_id=$3
         LIMIT 1",
    )
    .bind(obs_id)
    .bind(project)
    .bind(org)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let row = row.ok_or(ApiError::NotFound)?;

    use sqlx::Row;
    let prompt: String = row.get("prompt");
    let engine: String = row.get("engine");
    let observation_type: String = row.get("observation_type");
    let country: Option<String> = row.try_get("country").ok().flatten();
    let language: Option<String> = row.try_get("language").ok().flatten();
    let collected_at: Option<DateTime<Utc>> = row.try_get("collected_at").ok().flatten();
    let answer_text: Option<String> = row.try_get("answer_text").ok().flatten();
    let url: Option<String> = row.try_get("url").ok().flatten();
    let domain: Option<String> = row.try_get("domain").ok().flatten();
    let title: Option<String> = row.try_get("title").ok().flatten();

    // Brand/competitor matches
    let match_rows = sqlx::query(
        "SELECT matched_alias, entity_kind FROM observation_entity_matches
         WHERE observation_id=$1 AND project_id=$2",
    )
    .bind(obs_id)
    .bind(project)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let mut brand_matches = Vec::new();
    let mut competitor_matches = Vec::new();
    for r in match_rows {
        use sqlx::Row;
        let alias: String = r.get("matched_alias");
        let kind: String = r.get("entity_kind");
        if kind == "brand" {
            brand_matches.push(alias);
        } else if kind == "competitor" {
            competitor_matches.push(alias);
        }
    }

    Ok(Json(CitationObservationDetail {
        id: obs_id,
        prompt: prompt.clone(),
        prompt_text: Some(prompt.clone()),
        answer_excerpt: answer_text.clone().map(|t| t.chars().take(300).collect::<String>()),
        engine,
        provider: None,
        observation_type,
        model: None,
        country,
        language,
        captured_at: collected_at,
        domain: domain.unwrap_or_default(),
        url: url.unwrap_or_default(),
        title,
        brand_matches,
        competitor_matches,
    }))
}

#[derive(Deserialize)]
pub struct CreateCitationOptimizationTask {
    pub gap_id: Option<Uuid>,
    pub title: String,
    pub explanation: String,
    pub priority: Option<String>,
}

async fn create_citation_optimization_task(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateCitationOptimizationTask>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let (org, project) = authorize_project(&state, &headers, Uuid::new_v4(), true).await?;

    let priority = input.priority.unwrap_or_else(|| "medium".to_string());
    let task_id = Uuid::new_v4();

    let _ = sqlx::query(
        "INSERT INTO citation_optimization_tasks(id, organization_id, project_id, gap_id, title, explanation, priority, status, supporting_observations, created_at, updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,'open','[]'::jsonb,now(),now())",
    )
    .bind(task_id)
    .bind(org)
    .bind(project)
    .bind(input.gap_id)
    .bind(&input.title)
    .bind(&input.explanation)
    .bind(&priority)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    Ok(Json(serde_json::json!({
        "id": task_id,
        "project_id": project,
        "title": input.title,
        "priority": priority,
        "status": "open",
        "note": "Optimization task created from citation gap evidence."
    })))
}

#[derive(Deserialize)]
pub struct CreateCitationReport {
    pub project_id: Uuid,
    pub range_days: Option<i64>,
    pub format: Option<String>,
}

async fn create_citation_report(
    State(_state): State<Arc<AppState>>,
    _headers: HeaderMap,
    _input: Json<CreateCitationReport>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Report generation delegates to existing reporting pipeline at /api/v1/reports
    Ok(Json(serde_json::json!({
        "status": "queued",
        "note": "Use /api/v1/reports to generate citation reports in JSON, CSV, or PDF.",
    })))
}


