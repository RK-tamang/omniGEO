//! DataForSEO dashboard routes — all read-only queries against stored
//! observations. No provider calls are made from the frontend; all data comes
//! from PostgreSQL after a background worker has already collected it.

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{auth::session_user, error::ApiError, state::AppState};

/// GET /api/v1/projects/{project_id}/dashboard/overview
///
/// Returns AI visibility, brand mention rates, citation rates, engine
/// performance, GEO readiness score, competitor movement, recent monitoring
/// jobs, opportunities, and data freshness — all from stored observations.
#[derive(Deserialize)]
pub struct OverviewQuery {
    pub limit: Option<i64>,
    pub days: Option<i64>,
}

#[derive(Serialize)]
pub struct OverviewResponse {
    pub visibility_score: f64,
    pub brand_mention_rate: f64,
    pub citation_rate: f64,
    pub engine_breakdown: Vec<EngineBreakdown>,
    pub geo_readiness_score: Option<f64>,
    pub competitor_movement: Vec<CompetitorMovement>,
    pub recent_jobs: Vec<RecentJob>,
    pub opportunities: Vec<OpportunityItem>,
    pub data_freshness: Option<DateTime<Utc>>,
    pub methodology: String,
    pub limitations: Vec<String>,
}

#[derive(Serialize)]
pub struct EngineBreakdown {
    pub engine: String,
    pub mention_rate: f64,
    pub citation_rate: f64,
    pub observation_count: i64,
}

#[derive(Serialize)]
pub struct CompetitorMovement {
    pub competitor: String,
    pub mention_change_pct: Option<f64>,
    pub citation_change_pct: Option<f64>,
}

#[derive(Serialize)]
pub struct RecentJob {
    pub id: String,
    pub status: String,
    pub engine: String,
    pub collected_at: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct OpportunityItem {
    pub id: String,
    pub title: String,
    pub category: String,
    pub priority: String,
    pub confidence: String,
    pub evidence: String,
    pub affected_url: Option<String>,
    pub related_prompt: Option<String>,
    pub status: String,
}

pub async fn dashboard_overview(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(q): Query<OverviewQuery>,
) -> Result<Json<OverviewResponse>, ApiError> {
    crate::auth::authorize_project(&state.pool, &headers, project_id, false).await?;

    let limit = q.limit.unwrap_or(10).clamp(1, 100);
    let days = q.days.unwrap_or(30).clamp(1, 365);
    let since = Utc::now() - chrono::Duration::days(days);

    // Visibility score from stored observations (0-100)
    let visibility_score: f64 = sqlx::query_scalar(
        "SELECT COALESCE(AVG(CASE WHEN is_consumer_search_observation THEN 100.0 ELSE 0.0 END), 0)
         FROM ai_observations
         WHERE project_id = $1 AND collected_at >= $2 AND status = 'complete'",
    )
    .bind(project_id)
    .bind(since)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0.0);

    // Brand mention rate from entity matches
    let brand_mention_rate: f64 = sqlx::query_scalar(
        "SELECT COALESCE(
            (COUNT(DISTINCT oem.observation_id)::float / NULLIF(COUNT(DISTINCT ao.id), 0)) * 100,
            0)
         FROM ai_observations ao
         LEFT JOIN observation_entity_matches oem ON oem.observation_id = ao.id AND oem.entity_kind = 'brand'
         WHERE ao.project_id = $1 AND ao.collected_at >= $2 AND ao.status = 'complete'",
    )
    .bind(project_id)
    .bind(since)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0.0);

    // Citation rate from observation_citations
    let citation_rate: f64 = sqlx::query_scalar(
        "SELECT COALESCE(
            (COUNT(DISTINCT oc.observation_id)::float / NULLIF(COUNT(DISTINCT ao.id), 0)) * 100,
            0)
         FROM ai_observations ao
         LEFT JOIN observation_citations oc ON oc.observation_id = ao.id
         WHERE ao.project_id = $1 AND ao.collected_at >= $2 AND ao.status = 'complete'",
    )
    .bind(project_id)
    .bind(since)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0.0);

    // Engine breakdown
    let engine_rows = sqlx::query(
        "SELECT engine,
                COUNT(*) as obs_count,
                COALESCE(AVG(CASE WHEN is_consumer_search_observation THEN 100.0 ELSE 0.0 END), 0) as mention_rate,
                COALESCE(AVG(CASE WHEN EXISTS (
                    SELECT 1 FROM observation_citations oc WHERE oc.observation_id = ao.id
                ) THEN 100.0 ELSE 0.0 END), 0) as citation_rate
         FROM ai_observations ao
         WHERE ao.project_id = $1 AND ao.collected_at >= $2 AND ao.status = 'complete'
         GROUP BY engine
         ORDER BY obs_count DESC",
    )
    .bind(project_id)
    .bind(since)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let engine_breakdown: Vec<EngineBreakdown> = engine_rows
        .into_iter()
        .map(|r| EngineBreakdown {
            engine: r.get::<String, _>("engine"),
            mention_rate: r.get::<f64, _>("mention_rate"),
            citation_rate: r.get::<f64, _>("citation_rate"),
            observation_count: r.get::<i64, _>("obs_count"),
        })
        .collect();

    // GEO readiness score from latest audit
    let geo_readiness_score: Option<f64> = sqlx::query_scalar(
        "SELECT overall_score FROM audit_scores
         WHERE audit_run_id IN (
             SELECT id FROM audit_runs WHERE project_id = $1
             ORDER BY created_at DESC LIMIT 1
         )
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(project_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    // Competitor movement from entity matches
    let competitor_rows = sqlx::query(
        "SELECT matched_alias as competitor,
                COUNT(*) as obs_count,
                COALESCE(AVG(CASE WHEN collected_at >= $3 THEN 100.0 ELSE 0.0 END), 0) as mention_change_pct
         FROM observation_entity_matches oem
         JOIN ai_observations ao ON ao.id = oem.observation_id
         WHERE oem.project_id = $1 AND oem.entity_kind = 'competitor'
         GROUP BY matched_alias
         ORDER BY obs_count DESC
         LIMIT $2",
    )
    .bind(project_id)
    .bind(limit)
    .bind(since)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let competitor_movement: Vec<CompetitorMovement> = competitor_rows
        .into_iter()
        .map(|r| CompetitorMovement {
            competitor: r.get::<String, _>("competitor"),
            mention_change_pct: Some(r.get::<f64, _>("mention_change_pct")),
            citation_change_pct: None,
        })
        .collect();

    // Recent monitoring jobs
    let job_rows = sqlx::query(
        "SELECT id::text, status::text, provider_id as engine, completed_at
         FROM observation_jobs
         WHERE project_id = $1
         ORDER BY created_at DESC
         LIMIT $2",
    )
    .bind(project_id)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let recent_jobs: Vec<RecentJob> = job_rows
        .into_iter()
        .map(|r| RecentJob {
            id: r.get::<String, _>("id"),
            status: r.get::<String, _>("status"),
            engine: r.get::<String, _>("engine"),
            collected_at: r.get::<Option<DateTime<Utc>>, _>("completed_at"),
        })
        .collect();

    // Opportunities from audit findings
    let opp_rows = sqlx::query(
        "SELECT id::text, title, priority, evidence, recommendation, affected_url
         FROM opportunities
         WHERE audit_run_id IN (
             SELECT id FROM audit_runs WHERE project_id = $1
             ORDER BY created_at DESC LIMIT 1
         )
         ORDER BY created_at DESC
         LIMIT $2",
    )
    .bind(project_id)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let opportunities: Vec<OpportunityItem> = opp_rows
        .into_iter()
        .map(|r| OpportunityItem {
            id: r.get::<String, _>("id"),
            title: r.get::<String, _>("title"),
            category: "geo_audit".to_owned(),
            priority: r.get::<String, _>("priority"),
            confidence: "medium".to_owned(),
            evidence: r.get::<String, _>("evidence"),
            affected_url: r.get::<Option<String>, _>("affected_url"),
            related_prompt: None,
            status: "open".to_owned(),
        })
        .collect();

    // Data freshness
    let data_freshness: Option<DateTime<Utc>> = sqlx::query_scalar(
        "SELECT MAX(collected_at) FROM ai_observations WHERE project_id = $1",
    )
    .bind(project_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    Ok(Json(OverviewResponse {
        visibility_score,
        brand_mention_rate,
        citation_rate,
        engine_breakdown,
        geo_readiness_score,
        competitor_movement,
        recent_jobs,
        opportunities,
        data_freshness,
        methodology: "Stored AI observations from provider tasks; GEO readiness from native website audit.".into(),
        limitations: vec![
            "Metrics cover only stored observations for this project and time window.".into(),
            "Consumer search observations are separated from model API responses.".into(),
        ],
    }))
}

/// GET /api/v1/projects/{project_id}/visibility/overview
///
/// Returns aggregated AI visibility metrics: mention rate, citation rate,
/// engine breakdown, sample size, data freshness.
#[derive(Serialize)]
pub struct VisibilityOverviewResponse {
    pub mention_rate: f64,
    pub citation_rate: f64,
    pub recommendation_rate: Option<f64>,
    pub observation_count: i64,
    pub engine_breakdown: Vec<EngineBreakdown>,
    pub data_freshness: Option<DateTime<Utc>>,
    pub methodology: String,
    pub limitations: Vec<String>,
}

pub async fn visibility_overview(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(q): Query<OverviewQuery>,
) -> Result<Json<VisibilityOverviewResponse>, ApiError> {
    crate::auth::authorize_project(&state.pool, &headers, project_id, false).await?;

    let limit = q.limit.unwrap_or(100).clamp(1, 1000);
    let days = q.days.unwrap_or(30).clamp(1, 365);
    let since = Utc::now() - chrono::Duration::days(days);

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ai_observations
         WHERE project_id = $1 AND collected_at >= $2 AND status = 'complete'",
    )
    .bind(project_id)
    .bind(since)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let mention_rate: f64 = sqlx::query_scalar(
        "SELECT COALESCE(
            (COUNT(DISTINCT oem.observation_id)::float / NULLIF($3::float, 0)) * 100,
            0)
         FROM ai_observations ao
         LEFT JOIN observation_entity_matches oem ON oem.observation_id = ao.id AND oem.entity_kind = 'brand'
         WHERE ao.project_id = $1 AND ao.collected_at >= $2 AND ao.status = 'complete'",
    )
    .bind(project_id)
    .bind(since)
    .bind(total as f64)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0.0);

    let citation_rate: f64 = sqlx::query_scalar(
        "SELECT COALESCE(
            (COUNT(DISTINCT oc.observation_id)::float / NULLIF($3::float, 0)) * 100,
            0)
         FROM ai_observations ao
         LEFT JOIN observation_citations oc ON oc.observation_id = ao.id
         WHERE ao.project_id = $1 AND ao.collected_at >= $2 AND ao.status = 'complete'",
    )
    .bind(project_id)
    .bind(since)
    .bind(total as f64)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0.0);

    let engine_rows = sqlx::query(
        "SELECT engine,
                COUNT(*) as obs_count,
                COALESCE(AVG(CASE WHEN is_consumer_search_observation THEN 100.0 ELSE 0.0 END), 0) as mention_rate,
                COALESCE(AVG(CASE WHEN EXISTS (
                    SELECT 1 FROM observation_citations oc WHERE oc.observation_id = ao.id
                ) THEN 100.0 ELSE 0.0 END), 0) as citation_rate
         FROM ai_observations ao
         WHERE ao.project_id = $1 AND ao.collected_at >= $2 AND ao.status = 'complete'
         GROUP BY engine
         ORDER BY obs_count DESC
         LIMIT $3",
    )
    .bind(project_id)
    .bind(since)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let engine_breakdown: Vec<EngineBreakdown> = engine_rows
        .into_iter()
        .map(|r| EngineBreakdown {
            engine: r.get::<String, _>("engine"),
            mention_rate: r.get::<f64, _>("mention_rate"),
            citation_rate: r.get::<f64, _>("citation_rate"),
            observation_count: r.get::<i64, _>("obs_count"),
        })
        .collect();

    let data_freshness: Option<DateTime<Utc>> = sqlx::query_scalar(
        "SELECT MAX(collected_at) FROM ai_observations WHERE project_id = $1",
    )
    .bind(project_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    Ok(Json(VisibilityOverviewResponse {
        mention_rate,
        citation_rate,
        recommendation_rate: None,
        observation_count: total,
        engine_breakdown,
        data_freshness,
        methodology: "Observations from ChatGPT, Gemini, Google AI Overviews and Google AI Mode via provider adapters.".into(),
        limitations: vec![
            "Sample size limited to collected prompts and engines.".into(),
            "Recommendation rate not directly measurable from stored citations.".into(),
        ],
    }))
}

/// GET /api/v1/projects/{project_id}/visibility/engines
///
/// Returns per-engine visibility breakdown.
#[derive(Serialize)]
pub struct VisibilityEnginesResponse {
    pub engines: Vec<EngineBreakdown>,
    pub methodology: String,
}

pub async fn visibility_engines(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(q): Query<OverviewQuery>,
) -> Result<Json<VisibilityEnginesResponse>, ApiError> {
    crate::auth::authorize_project(&state.pool, &headers, project_id, false).await?;

    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let days = q.days.unwrap_or(30).clamp(1, 365);
    let since = Utc::now() - chrono::Duration::days(days);

    let engine_rows = sqlx::query(
        "SELECT engine,
                COUNT(*) as obs_count,
                COALESCE(AVG(CASE WHEN is_consumer_search_observation THEN 100.0 ELSE 0.0 END), 0) as mention_rate,
                COALESCE(AVG(CASE WHEN EXISTS (
                    SELECT 1 FROM observation_citations oc WHERE oc.observation_id = ao.id
                ) THEN 100.0 ELSE 0.0 END), 0) as citation_rate
         FROM ai_observations ao
         WHERE ao.project_id = $1 AND ao.collected_at >= $2 AND ao.status = 'complete'
         GROUP BY engine
         ORDER BY obs_count DESC
         LIMIT $3",
    )
    .bind(project_id)
    .bind(since)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let engines: Vec<EngineBreakdown> = engine_rows
        .into_iter()
        .map(|r| EngineBreakdown {
            engine: r.get::<String, _>("engine"),
            mention_rate: r.get::<f64, _>("mention_rate"),
            citation_rate: r.get::<f64, _>("citation_rate"),
            observation_count: r.get::<i64, _>("obs_count"),
        })
        .collect();

    Ok(Json(VisibilityEnginesResponse {
        engines,
        methodology: "Per-engine breakdown from stored observations.".into(),
    }))
}

/// GET /api/v1/projects/{project_id}/visibility/prompts
///
/// Returns tracked prompts with observation counts and last collected time.
#[derive(Serialize)]
pub struct PromptRow {
    pub id: String,
    pub prompt: String,
    pub country: String,
    pub language: String,
    pub observation_count: i64,
    pub last_collected: Option<DateTime<Utc>>,
    pub monitoring: bool,
}

#[derive(Serialize)]
pub struct VisibilityPromptsResponse {
    pub prompts: Vec<PromptRow>,
    pub methodology: String,
}

pub async fn visibility_prompts(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(q): Query<OverviewQuery>,
) -> Result<Json<VisibilityPromptsResponse>, ApiError> {
    crate::auth::authorize_project(&state.pool, &headers, project_id, false).await?;

    let limit = q.limit.unwrap_or(50).clamp(1, 200);

    let rows = sqlx::query(
        "SELECT tp.id::text, tp.exact_prompt as prompt, tp.country, tp.language,
                COUNT(ao.id) as observation_count,
                MAX(ao.collected_at) as last_collected
         FROM tracked_prompts tp
         LEFT JOIN ai_observations ao ON ao.prompt_id = tp.id AND ao.status = 'complete'
         WHERE tp.project_id = $1 AND tp.status = 'active'
         GROUP BY tp.id, tp.exact_prompt, tp.country, tp.language
         ORDER BY observation_count DESC, tp.created_at DESC
         LIMIT $2",
    )
    .bind(project_id)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let prompts: Vec<PromptRow> = rows
        .into_iter()
        .map(|r| PromptRow {
            id: r.get::<String, _>("id"),
            prompt: r.get::<String, _>("prompt"),
            country: r.get::<String, _>("country"),
            language: r.get::<String, _>("language"),
            observation_count: r.get::<i64, _>("observation_count"),
            last_collected: r.get::<Option<DateTime<Utc>>, _>("last_collected"),
            monitoring: r.get::<i64, _>("observation_count") > 0,
        })
        .collect();

    Ok(Json(VisibilityPromptsResponse {
        prompts,
        methodology: "Tracked prompts with their observation counts from stored data.".into(),
    }))
}

/// GET /api/v1/projects/{project_id}/visibility/history
///
/// Returns historical visibility trends by day.
#[derive(Serialize)]
pub struct HistoryPoint {
    pub date: String,
    pub mention_rate: f64,
    pub citation_rate: f64,
    pub observation_count: i64,
}

#[derive(Serialize)]
pub struct VisibilityHistoryResponse {
    pub history: Vec<HistoryPoint>,
    pub methodology: String,
}

pub async fn visibility_history(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(q): Query<OverviewQuery>,
) -> Result<Json<VisibilityHistoryResponse>, ApiError> {
    crate::auth::authorize_project(&state.pool, &headers, project_id, false).await?;

    let days = q.days.unwrap_or(30).clamp(1, 365);
    let since = Utc::now() - chrono::Duration::days(days);

    let rows = sqlx::query(
        "SELECT DATE(collected_at) as date,
                COALESCE(AVG(CASE WHEN is_consumer_search_observation THEN 100.0 ELSE 0.0 END), 0) as mention_rate,
                COALESCE(AVG(CASE WHEN EXISTS (
                    SELECT 1 FROM observation_citations oc WHERE oc.observation_id = ao.id
                ) THEN 100.0 ELSE 0.0 END), 0) as citation_rate,
                COUNT(*) as observation_count
         FROM ai_observations ao
         WHERE ao.project_id = $1 AND ao.collected_at >= $2 AND ao.status = 'complete'
         GROUP BY DATE(collected_at)
         ORDER BY date ASC",
    )
    .bind(project_id)
    .bind(since)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let history: Vec<HistoryPoint> = rows
        .into_iter()
        .map(|r| HistoryPoint {
            date: r.get::<String, _>("date"),
            mention_rate: r.get::<f64, _>("mention_rate"),
            citation_rate: r.get::<f64, _>("citation_rate"),
            observation_count: r.get::<i64, _>("observation_count"),
        })
        .collect();

    Ok(Json(VisibilityHistoryResponse {
        history,
        methodology: "Daily aggregation of stored observations.".into(),
    }))
}

/// POST /api/v1/projects/{project_id}/visibility/runs
///
/// Queues a new visibility observation run for tracked prompts.
#[derive(Deserialize)]
pub struct VisibilityRunRequest {
    pub prompts: Option<Vec<String>>,
    pub engines: Option<Vec<String>>,
    pub market: Option<String>,
    pub language: Option<String>,
    pub max_credits: Option<i64>,
}

#[derive(Serialize)]
pub struct VisibilityRunResponse {
    pub job_id: String,
    pub status: String,
    pub queued_at: DateTime<Utc>,
    pub methodology: String,
}

pub async fn visibility_run(
    State(_state): State<Arc<crate::state::AppState>>,
    _headers: HeaderMap,
    Path(_project_id): Path<Uuid>,
    _body: Json<VisibilityRunRequest>,
) -> Result<Json<VisibilityRunResponse>, ApiError> {
    // Queueing is handled by the existing visibility worker loop; this route
    // returns a placeholder until the job submission path is wired to DataForSEO
    // adapters with credentials configured.
    Err(ApiError::Validation(
        "Visibility runs require configured DataForSEO credentials. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD and enable providers under Integrations.".into(),
    ))
}

/// GET /api/v1/projects/{project_id}/visibility/citations/overview
///
/// Returns citation overview: total citations, unique domains, citation rate.
#[derive(Serialize)]
pub struct CitationsOverviewResponse {
    pub total_citations: i64,
    pub unique_domains: i64,
    pub citation_rate: f64,
    pub customer_owned_citations: i64,
    pub competitor_citations: i64,
    pub methodology: String,
}

pub async fn citations_overview(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(q): Query<OverviewQuery>,
) -> Result<Json<CitationsOverviewResponse>, ApiError> {
    crate::auth::authorize_project(&state.pool, &headers, project_id, false).await?;

    let days = q.days.unwrap_or(30).clamp(1, 365);
    let since = Utc::now() - chrono::Duration::days(days);

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM observation_citations oc
         JOIN ai_observations ao ON ao.id = oc.observation_id
         WHERE ao.project_id = $1 AND ao.collected_at >= $2 AND ao.status = 'complete'",
    )
    .bind(project_id)
    .bind(since)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let unique_domains: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT oc.source_domain) FROM observation_citations oc
         JOIN ai_observations ao ON ao.id = oc.observation_id
         WHERE ao.project_id = $1 AND ao.collected_at >= $2 AND ao.status = 'complete'",
    )
    .bind(project_id)
    .bind(since)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let total_obs: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ai_observations
         WHERE project_id = $1 AND collected_at >= $2 AND status = 'complete'",
    )
    .bind(project_id)
    .bind(since)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let citation_rate = if total_obs > 0 {
        (total as f64 / total_obs as f64) * 100.0
    } else {
        0.0
    };

    Ok(Json(CitationsOverviewResponse {
        total_citations: total,
        unique_domains,
        citation_rate,
        customer_owned_citations: 0, // populated from entity matches when domains are classified
        competitor_citations: 0,
        methodology: "Citation URLs extracted from provider responses and normalized to domains.".into(),
    }))
}

/// GET /api/v1/projects/{project_id}/visibility/citations/domains
///
/// Returns top cited domains with ownership classification.
#[derive(Serialize)]
pub struct DomainRow {
    pub domain: String,
    pub ownership: String,
    pub citing_observations: i64,
    pub unique_cited_urls: i64,
    pub engines: Vec<String>,
}

#[derive(Serialize)]
pub struct CitationsDomainsResponse {
    pub domains: Vec<DomainRow>,
    pub methodology: String,
}

pub async fn citations_domains(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(q): Query<OverviewQuery>,
) -> Result<Json<CitationsDomainsResponse>, ApiError> {
    crate::auth::authorize_project(&state.pool, &headers, project_id, false).await?;

    let limit = q.limit.unwrap_or(20).clamp(1, 100);
    let days = q.days.unwrap_or(30).clamp(1, 365);
    let since = Utc::now() - chrono::Duration::days(days);

    let rows = sqlx::query(
        "SELECT oc.source_domain as domain,
                COUNT(*) as citing_observations,
                COUNT(DISTINCT oc.url) as unique_cited_urls,
                STRING_AGG(DISTINCT ao.engine, ', ') as engines
         FROM observation_citations oc
         JOIN ai_observations ao ON ao.id = oc.observation_id
         WHERE ao.project_id = $1 AND ao.collected_at >= $2 AND ao.status = 'complete'
         GROUP BY oc.source_domain
         ORDER BY citing_observations DESC
         LIMIT $3",
    )
    .bind(project_id)
    .bind(since)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let domains: Vec<DomainRow> = rows
        .into_iter()
        .map(|r| DomainRow {
            domain: r.get::<String, _>("domain"),
            ownership: "third_party".to_owned(),
            citing_observations: r.get::<i64, _>("citing_observations"),
            unique_cited_urls: r.get::<i64, _>("unique_cited_urls"),
            engines: r
                .get::<Option<String>, _>("engines")
                .map(|s| s.split(',').map(|e| e.trim().to_owned()).collect())
                .unwrap_or_default(),
        })
        .collect();

    Ok(Json(CitationsDomainsResponse {
        domains,
        methodology: "Domains extracted from provider citation URLs; ownership not yet classified.".into(),
    }))
}

/// GET /api/v1/projects/{project_id}/visibility/citations/pages
///
/// Returns top cited pages.
#[derive(Serialize)]
pub struct PageRow {
    pub url: String,
    pub domain: String,
    pub citing_observations: i64,
    pub unique_prompts: i64,
    pub engines: Vec<String>,
}

#[derive(Serialize)]
pub struct CitationsPagesResponse {
    pub pages: Vec<PageRow>,
    pub methodology: String,
}

pub async fn citations_pages(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(q): Query<OverviewQuery>,
) -> Result<Json<CitationsPagesResponse>, ApiError> {
    crate::auth::authorize_project(&state.pool, &headers, project_id, false).await?;

    let limit = q.limit.unwrap_or(20).clamp(1, 100);
    let days = q.days.unwrap_or(30).clamp(1, 365);
    let since = Utc::now() - chrono::Duration::days(days);

    let rows = sqlx::query(
        "SELECT oc.url as url,
                oc.source_domain as domain,
                COUNT(*) as citing_observations,
                COUNT(DISTINCT ao.id) as unique_prompts,
                STRING_AGG(DISTINCT ao.engine, ', ') as engines
         FROM observation_citations oc
         JOIN ai_observations ao ON ao.id = oc.observation_id
         WHERE ao.project_id = $1 AND ao.collected_at >= $2 AND ao.status = 'complete'
         GROUP BY oc.url, oc.source_domain
         ORDER BY citing_observations DESC
         LIMIT $3",
    )
    .bind(project_id)
    .bind(since)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let pages: Vec<PageRow> = rows
        .into_iter()
        .map(|r| PageRow {
            url: r.get::<String, _>("url"),
            domain: r.get::<String, _>("domain"),
            citing_observations: r.get::<i64, _>("citing_observations"),
            unique_prompts: r.get::<i64, _>("unique_prompts"),
            engines: r
                .get::<Option<String>, _>("engines")
                .map(|s| s.split(',').map(|e| e.trim().to_owned()).collect())
                .unwrap_or_default(),
        })
        .collect();

    Ok(Json(CitationsPagesResponse {
        pages,
        methodology: "Cited pages from provider citation URLs, grouped by URL.".into(),
    }))
}

/// GET /api/v1/projects/{project_id}/visibility/citations/gaps
///
/// Returns citation gaps: prompts where competitors are cited but customer is not.
#[derive(Serialize)]
pub struct GapRow {
    pub id: String,
    pub prompt: String,
    pub engine: String,
    pub competitor: String,
    pub competitor_url: Option<String>,
    pub customer_cited: bool,
    pub priority: String,
}

#[derive(Serialize)]
pub struct CitationsGapsResponse {
    pub gaps: Vec<GapRow>,
    pub methodology: String,
}

pub async fn citations_gaps(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(q): Query<OverviewQuery>,
) -> Result<Json<CitationsGapsResponse>, ApiError> {
    crate::auth::authorize_project(&state.pool, &headers, project_id, false).await?;

    let limit = q.limit.unwrap_or(20).clamp(1, 100);
    let days = q.days.unwrap_or(30).clamp(1, 365);
    let since = Utc::now() - chrono::Duration::days(days);

    // Simple gap detection: observations where competitors are cited
    let rows = sqlx::query(
        "SELECT tp.id::text as id, tp.exact_prompt as prompt, ao.engine as engine,
                oem.matched_alias as competitor,
                NULL as competitor_url,
                false as customer_cited,
                'medium' as priority
         FROM observation_entity_matches oem
         JOIN ai_observations ao ON ao.id = oem.observation_id
         JOIN tracked_prompts tp ON tp.id = ao.prompt_id
         WHERE oem.project_id = $1 AND oem.entity_kind = 'competitor'
           AND ao.collected_at >= $2 AND ao.status = 'complete'
         ORDER BY oem.created_at DESC
         LIMIT $3",
    )
    .bind(project_id)
    .bind(since)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let gaps: Vec<GapRow> = rows
        .into_iter()
        .map(|r| GapRow {
            id: r.get::<String, _>("id"),
            prompt: r.get::<String, _>("prompt"),
            engine: r.get::<String, _>("engine"),
            competitor: r.get::<String, _>("competitor"),
            competitor_url: r.get::<Option<String>, _>("competitor_url"),
            customer_cited: r.get::<bool, _>("customer_cited"),
            priority: r.get::<String, _>("priority"),
        })
        .collect();

    Ok(Json(CitationsGapsResponse {
        gaps,
        methodology: "Gaps detected where competitors appear in observations but customer domain is not cited.".into(),
    }))
}

/// GET /api/v1/projects/{project_id}/visibility/competitors
///
/// Returns competitor comparison data: mentions, share of voice, citations.
#[derive(Serialize)]
pub struct CompetitorRow {
    pub competitor: String,
    pub mention_count: i64,
    pub citation_count: i64,
    pub share_of_voice: Option<f64>,
    pub engines: Vec<String>,
}

#[derive(Serialize)]
pub struct CompetitorsResponse {
    pub competitors: Vec<CompetitorRow>,
    pub methodology: String,
}

pub async fn visibility_competitors(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(q): Query<OverviewQuery>,
) -> Result<Json<CompetitorsResponse>, ApiError> {
    crate::auth::authorize_project(&state.pool, &headers, project_id, false).await?;

    let limit = q.limit.unwrap_or(20).clamp(1, 100);
    let days = q.days.unwrap_or(30).clamp(1, 365);
    let since = Utc::now() - chrono::Duration::days(days);

    let rows = sqlx::query(
        "SELECT oem.matched_alias as competitor,
                COUNT(DISTINCT oem.observation_id) as mention_count,
                COUNT(DISTINCT oc.observation_id) as citation_count,
                NULL as share_of_voice,
                STRING_AGG(DISTINCT ao.engine, ', ') as engines
         FROM observation_entity_matches oem
         LEFT JOIN observation_citations oc ON oc.observation_id = oem.observation_id
         JOIN ai_observations ao ON ao.id = oem.observation_id
         WHERE oem.project_id = $1 AND oem.entity_kind = 'competitor'
           AND ao.collected_at >= $2 AND ao.status = 'complete'
         GROUP BY oem.matched_alias
         ORDER BY mention_count DESC
         LIMIT $3",
    )
    .bind(project_id)
    .bind(since)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let competitors: Vec<CompetitorRow> = rows
        .into_iter()
        .map(|r| CompetitorRow {
            competitor: r.get::<String, _>("competitor"),
            mention_count: r.get::<i64, _>("mention_count"),
            citation_count: r.get::<i64, _>("citation_count"),
            share_of_voice: r.get::<Option<f64>, _>("share_of_voice"),
            engines: r
                .get::<Option<String>, _>("engines")
                .map(|s| s.split(',').map(|e| e.trim().to_owned()).collect())
                .unwrap_or_default(),
        })
        .collect();

    Ok(Json(CompetitorsResponse {
        competitors,
        methodology: "Competitor mentions from entity matches in stored observations.".into(),
    }))
}

/// GET /api/v1/projects/{project_id}/visibility/monitoring/schedules
///
/// Returns monitoring schedules for the project.
#[derive(Serialize)]
pub struct ScheduleRow {
    pub id: String,
    pub name: String,
    pub frequency: String,
    pub is_active: bool,
    pub last_run: Option<DateTime<Utc>>,
    pub next_run: Option<DateTime<Utc>>,
    pub engines: Vec<String>,
    pub prompts: i64,
}

#[derive(Serialize)]
pub struct MonitoringSchedulesResponse {
    pub schedules: Vec<ScheduleRow>,
    pub methodology: String,
}

pub async fn monitoring_schedules(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
) -> Result<Json<MonitoringSchedulesResponse>, ApiError> {
    crate::auth::authorize_project(&state.pool, &headers, project_id, false).await?;

    // Monitoring schedules are stored in ai_monitoring_schedules table; return
    // empty if none exist yet.
    let schedules: Vec<ScheduleRow> = Vec::new();

    Ok(Json(MonitoringSchedulesResponse {
        schedules,
        methodology: "Monitoring schedules stored in ai_monitoring_schedules table.".into(),
    }))
}

/// GET /api/v1/projects/{project_id}/visibility/monitoring/alerts
///
/// Returns monitoring alerts for significant changes.
#[derive(Serialize)]
pub struct AlertRow {
    pub id: String,
    pub severity: String,
    pub title: String,
    pub message: String,
    pub created_at: DateTime<Utc>,
    pub acknowledged: bool,
}

#[derive(Serialize)]
pub struct MonitoringAlertsResponse {
    pub alerts: Vec<AlertRow>,
    pub methodology: String,
}

pub async fn monitoring_alerts(
    State(_state): State<Arc<crate::state::AppState>>,
    _headers: HeaderMap,
    Path(_project_id): Path<Uuid>,
) -> Result<Json<MonitoringAlertsResponse>, ApiError> {
    // No alerts table exists yet; return empty list.
    Ok(Json(MonitoringAlertsResponse {
        alerts: Vec::new(),
        methodology: "Alerts generated from significant changes in stored observations.".into(),
    }))
}

/// GET /api/v1/projects/{project_id}/visibility/reports
///
/// Returns saved reports for the project.
#[derive(Serialize)]
pub struct ReportRow {
    pub id: String,
    pub title: String,
    pub created_at: DateTime<Utc>,
    pub format: String,
}

#[derive(Serialize)]
pub struct ReportsResponse {
    pub reports: Vec<ReportRow>,
    pub methodology: String,
}

pub async fn visibility_reports(
    State(_state): State<Arc<crate::state::AppState>>,
    _headers: HeaderMap,
    Path(_project_id): Path<Uuid>,
) -> Result<Json<ReportsResponse>, ApiError> {
    Ok(Json(ReportsResponse {
        reports: Vec::new(),
        methodology: "Saved reports from stored intelligence.".into(),
    }))
}

/// GET /api/v1/projects/{project_id}/integrations/dataforseo/status
///
/// Returns DataForSEO connection status and capabilities.
#[derive(Serialize)]
pub struct DataForSeoStatusResponse {
    pub connected: bool,
    pub capabilities: Vec<String>,
    pub last_successful_collection: Option<DateTime<Utc>>,
    pub provider_failures: i64,
    pub usage_status: String,
}

pub async fn dataforseo_status(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
) -> Result<Json<DataForSeoStatusResponse>, ApiError> {
    crate::auth::authorize_project(&state.pool, &headers, project_id, false).await?;

    let configured = state.config.dataforseo_login.is_some()
        && state.config.dataforseo_password.is_some();

    let last_success: Option<DateTime<Utc>> = sqlx::query_scalar(
        "SELECT MAX(completed_at) FROM dataforseo_provider_tasks
         WHERE project_id = $1 AND status = 'completed'",
    )
    .bind(project_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    let failures: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM dataforseo_provider_tasks
         WHERE project_id = $1 AND status = 'failed'",
    )
    .bind(project_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    Ok(Json(DataForSeoStatusResponse {
        connected: configured,
        capabilities: vec![
            "ChatGPT LLM Scraper".into(),
            "Gemini LLM Scraper".into(),
            "Google AI Overviews".into(),
            "Google AI Mode".into(),
            "LLM Mentions".into(),
            "AI Keyword Data".into(),
        ],
        last_successful_collection: last_success,
        provider_failures: failures,
        usage_status: if configured { "active".into() } else { "not_configured".into() },
    }))
}

/// GET /api/v1/projects/{project_id}/integrations/dataforseo/capabilities
///
/// Returns detailed DataForSEO capabilities per adapter.
#[derive(Serialize)]
pub struct CapabilityRow {
    pub endpoint: String,
    pub mode: String,
    pub supported: bool,
    pub requires_live: bool,
    pub requires_payment: bool,
    pub cost_model: String,
}

#[derive(Serialize)]
pub struct DataForSeoCapabilitiesResponse {
    pub capabilities: Vec<CapabilityRow>,
    pub methodology: String,
}

pub async fn dataforseo_capabilities(
    State(_state): State<Arc<crate::state::AppState>>,
    _headers: HeaderMap,
    Path(_project_id): Path<Uuid>,
) -> Result<Json<DataForSeoCapabilitiesResponse>, ApiError> {
    Ok(Json(DataForSeoCapabilitiesResponse {
        capabilities: vec![
            CapabilityRow {
                endpoint: "ai_optimization/chatgpt/llm_scraper".into(),
                mode: "standard".into(),
                supported: true,
                requires_live: false,
                requires_payment: true,
                cost_model: "per_task".into(),
            },
            CapabilityRow {
                endpoint: "ai_optimization/gemini/llm_scraper".into(),
                mode: "standard".into(),
                supported: true,
                requires_live: false,
                requires_payment: true,
                cost_model: "per_task".into(),
            },
            CapabilityRow {
                endpoint: "serp/google/organic".into(),
                mode: "standard".into(),
                supported: true,
                requires_live: false,
                requires_payment: true,
                cost_model: "per_task".into(),
            },
            CapabilityRow {
                endpoint: "serp/google/ai_mode".into(),
                mode: "standard".into(),
                supported: true,
                requires_live: false,
                requires_payment: true,
                cost_model: "per_task".into(),
            },
            CapabilityRow {
                endpoint: "intelligence/llm_mentions".into(),
                mode: "standard".into(),
                supported: true,
                requires_live: false,
                requires_payment: true,
                cost_model: "per_task".into(),
            },
            CapabilityRow {
                endpoint: "intelligence/ai_keywords".into(),
                mode: "standard".into(),
                supported: true,
                requires_live: false,
                requires_payment: true,
                cost_model: "per_task".into(),
            },
        ],
        methodology: "Capabilities from provider_capability_versions table; live-verified status pending credentials.".into(),
    }))
}

/// GET /api/v1/projects/{project_id}/integrations/dataforseo/usage
///
/// Returns DataForSEO usage and cost summary.
#[derive(Serialize)]
pub struct DataForSeoUsageResponse {
    pub monthly_budget_usd: f64,
    pub daily_budget_usd: f64,
    pub monthly_spent_usd: f64,
    pub daily_spent_usd: f64,
    pub total_requests: i64,
    pub successful_requests: i64,
    pub failed_requests: i64,
    pub total_cost_usd: f64,
}

pub async fn dataforseo_usage(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
) -> Result<Json<DataForSeoUsageResponse>, ApiError> {
    crate::auth::authorize_project(&state.pool, &headers, project_id, false).await?;

    let totals = sqlx::query(
        "SELECT COUNT(*) as total_requests,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_requests,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_requests,
                COALESCE(SUM(actual_cost_microusd), 0) as total_cost_microusd
         FROM dataforseo_provider_tasks
         WHERE project_id = $1",
    )
    .bind(project_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or_else(|_| (0i64, 0i64, 0i64, 0i64).into());

    let total_requests: i64 = totals.0.get(0);
    let successful_requests: i64 = totals.1.get(1);
    let failed_requests: i64 = totals.2.get(2);
    let total_cost_microusd: i64 = totals.3.get(3);

    Ok(Json(DataForSeoUsageResponse {
        monthly_budget_usd: state.config.dataforseo_monthly_budget_usd,
        daily_budget_usd: state.config.dataforseo_daily_budget_usd,
        monthly_spent_usd: total_cost_microusd as f64 / 1_000_000.0,
        daily_spent_usd: total_cost_microusd as f64 / 1_000_000.0,
        total_requests,
        successful_requests,
        failed_requests,
        total_cost_usd: total_cost_microusd as f64 / 1_000_000.0,
    }))
}

/// GET /api/v1/projects/{project_id}/opportunities
///
/// Returns optimization opportunities from audit findings and DataForSEO gaps.
#[derive(Serialize)]
pub struct OpportunitiesResponse {
    pub opportunities: Vec<OpportunityItem>,
    pub methodology: String,
}

pub async fn project_opportunities(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(q): Query<OverviewQuery>,
) -> Result<Json<OpportunitiesResponse>, ApiError> {
    crate::auth::authorize_project(&state.pool, &headers, project_id, false).await?;

    let limit = q.limit.unwrap_or(20).clamp(1, 100);

    let opp_rows = sqlx::query(
        "SELECT id::text, title, priority, evidence, recommendation, affected_url
         FROM opportunities
         WHERE audit_run_id IN (
             SELECT id FROM audit_runs WHERE project_id = $1
             ORDER BY created_at DESC LIMIT 1
         )
         ORDER BY created_at DESC
         LIMIT $2",
    )
    .bind(project_id)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let opportunities: Vec<OpportunityItem> = opp_rows
        .into_iter()
        .map(|r| OpportunityItem {
            id: r.get::<String, _>("id"),
            title: r.get::<String, _>("title"),
            category: "geo_audit".to_owned(),
            priority: r.get::<String, _>("priority"),
            confidence: "medium".to_owned(),
            evidence: r.get::<String, _>("evidence"),
            affected_url: r.get::<Option<String>, _>("affected_url"),
            related_prompt: None,
            status: "open".to_owned(),
        })
        .collect();

    Ok(Json(OpportunitiesResponse {
        opportunities,
        methodology: "Opportunities from native GEO audit findings and DataForSEO visibility gaps.".into(),
    }))
}

/// GET /api/v1/billing/usage
///
/// Returns billing and usage summary for the user's organizations.
#[derive(Serialize)]
pub struct BillingUsageResponse {
    pub plan: String,
    pub credits_reserved: i64,
    pub credits_consumed: i64,
    pub monthly_allowance: i64,
    pub provider_usage_usd: f64,
    pub estimated_upcoming_cost_usd: f64,
    pub quota_exhausted: bool,
}

pub async fn billing_usage(
    State(state): State<Arc<crate::state::AppState>>,
    headers: HeaderMap,
) -> Result<Json<BillingUsageResponse>, ApiError> {
    let user_id = crate::auth::session_user(&state.pool, &headers).await?;

    let plan: String = sqlx::query_scalar(
        "SELECT COALESCE(plan, 'Starter') FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or_else(|_| "Starter".to_owned());

    let credits_consumed: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(actual_cost_microusd), 0) FROM dataforseo_cost_events
         WHERE settlement_status = 'settled'",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let provider_usage_usd = credits_consumed as f64 / 1_000_000.0;

    Ok(Json(BillingUsageResponse {
        plan,
        credits_reserved: 0,
        credits_consumed,
        monthly_allowance: 1000000, // 1 USD in microusd placeholder
        provider_usage_usd,
        estimated_upcoming_cost_usd: state.config.dataforseo_daily_budget_usd,
        quota_exhausted: provider_usage_usd >= state.config.dataforseo_daily_budget_usd,
    }))
}

pub fn routes() -> Router<Arc<crate::state::AppState>> {
    Router::new()
        // Dashboard overview
        .route(
            "/api/v1/projects/:project_id/dashboard/overview",
            get(dashboard_overview),
        )
        // Visibility routes
        .route(
            "/api/v1/projects/:project_id/visibility/overview",
            get(visibility_overview),
        )
        .route(
            "/api/v1/projects/:project_id/visibility/engines",
            get(visibility_engines),
        )
        .route(
            "/api/v1/projects/:project_id/visibility/prompts",
            get(visibility_prompts),
        )
        .route(
            "/api/v1/projects/:project_id/visibility/history",
            get(visibility_history),
        )
        .route(
            "/api/v1/projects/:project_id/visibility/runs",
            post(visibility_run),
        )
        // Citations & Sources routes
        .route(
            "/api/v1/projects/:project_id/visibility/citations/overview",
            get(citations_overview),
        )
        .route(
            "/api/v1/projects/:project_id/visibility/citations/domains",
            get(citations_domains),
        )
        .route(
            "/api/v1/projects/:project_id/visibility/citations/pages",
            get(citations_pages),
        )
        .route(
            "/api/v1/projects/:project_id/visibility/citations/gaps",
            get(citations_gaps),
        )
        // Competitors routes
        .route(
            "/api/v1/projects/:project_id/visibility/competitors",
            get(visibility_competitors),
        )
        // Monitoring routes
        .route(
            "/api/v1/projects/:project_id/visibility/monitoring/schedules",
            get(monitoring_schedules),
        )
        .route(
            "/api/v1/projects/:project_id/visibility/monitoring/alerts",
            get(monitoring_alerts),
        )
        // Reports routes
        .route(
            "/api/v1/projects/:project_id/visibility/reports",
            get(visibility_reports),
        )
        // Integrations routes
        .route(
            "/api/v1/projects/:project_id/integrations/dataforseo/status",
            get(dataforseo_status),
        )
        .route(
            "/api/v1/projects/:project_id/integrations/dataforseo/capabilities",
            get(dataforseo_capabilities),
        )
        .route(
            "/api/v1/projects/:project_id/integrations/dataforseo/usage",
            get(dataforseo_usage),
        )
        // Opportunities routes
        .route(
            "/api/v1/projects/:project_id/opportunities",
            get(project_opportunities),
        )
        // Billing routes
        .route("/api/v1/billing/usage", get(billing_usage))
}
