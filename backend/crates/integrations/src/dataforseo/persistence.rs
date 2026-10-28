//! DataForSEO persistence helpers.

use sqlx::PgPool;
use uuid::Uuid;
use serde_json::Value;

/// Record a DataForSEO provider task submission.
pub async fn record_task(
    pool: &PgPool,
    organization_id: Uuid,
    project_id: Uuid,
    observation_job_id: Option<Uuid>,
    provider_task_id: &str,
    adapter_name: &str,
    engine: &str,
    surface: &str,
    country: &str,
    language: &str,
    prompt: &str,
    mode: &str,
    estimated_cost_microusd: i64,
) -> Result<Uuid, sqlx::Error> {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO dataforseo_provider_tasks
            (id, organization_id, project_id, observation_job_id, provider_task_id,
             adapter_name, engine, surface, country, language, prompt, mode,
             estimated_cost_microusd, status, submitted_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'submitted',now())
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(organization_id)
    .bind(project_id)
    .bind(observation_job_id)
    .bind(provider_task_id)
    .bind(adapter_name)
    .bind(engine)
    .bind(surface)
    .bind(country)
    .bind(language)
    .bind(prompt)
    .bind(mode)
    .bind(estimated_cost_microusd)
    .fetch_one(pool)
    .await
    .map(|row| row.get::<Uuid, _>("id"))
}

/// Mark a task as completed with actual cost.
pub async fn complete_task(
    pool: &PgPool,
    task_id: Uuid,
    actual_cost_microusd: Option<i64>,
    response_payload: &serde_json::Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE dataforseo_provider_tasks
        SET status='completed', completed_at=now(), response_payload=$2,
            actual_cost_microusd=$3, updated_at=now()
        WHERE id=$1
        "#,
    )
    .bind(task_id)
    .bind(response_payload)
    .bind(actual_cost_microusd)
    .execute(pool)
    .await?;
    Ok(())
}

/// Mark a task as failed.
pub async fn fail_task(
    pool: &PgPool,
    task_id: Uuid,
    error_code: Option<&str>,
    error_message: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE dataforseo_provider_tasks
        SET status='failed', completed_at=now(), error_code=$2, error_message=$3,
            updated_at=now()
        WHERE id=$1
        "#,
    )
    .bind(task_id)
    .bind(error_code)
    .bind(error_message)
    .execute(pool)
    .await?;
    Ok(())
}

/// Record a DataForSEO cost event.
pub async fn record_cost_event(
    pool: &PgPool,
    organization_id: Uuid,
    project_id: Uuid,
    task_id: Option<Uuid>,
    provider_task_id: Option<&str>,
    adapter_name: &str,
    endpoint: &str,
    mode: &str,
    estimated_microusd: i64,
    actual_microusd: Option<i64>,
    status: &str,
) -> Result<Uuid, sqlx::Error> {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO dataforseo_cost_events
            (id, organization_id, project_id, task_id, provider_task_id,
             adapter_name, endpoint, mode, estimated_microusd, actual_microusd,
             settlement_status, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(organization_id)
    .bind(project_id)
    .bind(task_id)
    .bind(provider_task_id)
    .bind(adapter_name)
    .bind(endpoint)
    .bind(mode)
    .bind(estimated_microusd)
    .bind(actual_microusd)
    .bind(status)
    .fetch_one(pool)
    .await
    .map(|row| row.get::<Uuid, _>("id"))
}

/// Record AI keyword estimate.
pub async fn record_keyword_estimate(
    pool: &PgPool,
    organization_id: Uuid,
    project_id: Uuid,
    task_id: Option<Uuid>,
    keyword: &str,
    market: &str,
    language: &str,
    ai_search_volume_estimate: Option<i64>,
    monthly_search_volume: Option<i64>,
    cpc_usd: Option<f64>,
    competition_level: Option<f64>,
    platform: Option<&str>,
    source: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO ai_keyword_estimates
            (organization_id, project_id, task_id, keyword, market, language,
             ai_search_volume_estimate, monthly_search_volume, cpc_usd,
             competition_level, platform, source, collected_at, expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(), now() + interval '7 days')
        "#,
    )
    .bind(organization_id)
    .bind(project_id)
    .bind(task_id)
    .bind(keyword)
    .bind(market)
    .bind(language)
    .bind(ai_search_volume_estimate)
    .bind(monthly_search_volume)
    .bind(cpc_usd)
    .bind(competition_level)
    .bind(platform)
    .bind(source)
    .execute(pool)
    .await?;
    Ok(())
}
