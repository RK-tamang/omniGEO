use anyhow::Result;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

pub async fn enqueue(
    tx: &mut Transaction<'_, Postgres>,
    requested_url: &str,
    canonical_url: &str,
    project_id: Option<Uuid>,
    page_limit: i32,
    byte_limit: i32,
    access_token_hash: &str,
) -> Result<(Uuid, Uuid)> {
    let audit_id = Uuid::new_v4();
    let job_id = Uuid::new_v4();
    sqlx::query("INSERT INTO audit_runs (id,project_id,requested_url,canonical_url,status,page_limit,byte_limit) VALUES ($1,$2,$3,$4,'queued',$5,$6)").bind(audit_id).bind(project_id).bind(requested_url).bind(canonical_url).bind(page_limit).bind(byte_limit).execute(&mut **tx).await?;
    sqlx::query("INSERT INTO crawl_jobs (id,audit_run_id,deduplication_key,status,payload) VALUES ($1,$2,$3,'queued',jsonb_build_object('url',$4))").bind(job_id).bind(audit_id).bind(format!("audit:{audit_id}" )).bind(canonical_url).execute(&mut **tx).await?;
    sqlx::query("INSERT INTO audit_access_tokens (audit_run_id,token_hash,expires_at) VALUES ($1,$2,now() + interval '90 days')")
        .bind(audit_id).bind(access_token_hash).execute(&mut **tx).await?;
    Ok((audit_id, job_id))
}

pub async fn pool_enqueue(
    pool: &PgPool,
    requested_url: &str,
    canonical_url: &str,
    project_id: Option<Uuid>,
    page_limit: i32,
    byte_limit: i32,
    access_token_hash: &str,
) -> Result<(Uuid, Uuid)> {
    let mut tx = pool.begin().await?;
    let ids = enqueue(
        &mut tx,
        requested_url,
        canonical_url,
        project_id,
        page_limit,
        byte_limit,
        access_token_hash,
    )
    .await?;
    tx.commit().await?;
    Ok(ids)
}
