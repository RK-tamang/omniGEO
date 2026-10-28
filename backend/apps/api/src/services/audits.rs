use crate::{
    config::Config, crawler::safe_url::CanonicalUrl, models::audit::AuditJobReference,
    repositories::audits,
};
use anyhow::Result;
use sha2::{Digest, Sha256};
use uuid::Uuid;

pub async fn queue(
    pool: &sqlx::PgPool,
    config: &Config,
    requested_url: String,
    project_id: Option<Uuid>,
    max_pages: Option<usize>,
) -> Result<AuditJobReference> {
    let canonical = CanonicalUrl::parse(&requested_url).map_err(anyhow::Error::msg)?;
    let limit = max_pages
        .unwrap_or(config.crawl_page_limit)
        .clamp(1, config.crawl_page_limit) as i32;
    let access_token = Uuid::new_v4().to_string();
    let token_hash = hash_access_token(&access_token);
    let (audit_id, job_id) = audits::pool_enqueue(
        pool,
        &requested_url,
        canonical.as_str(),
        project_id,
        limit,
        config.crawl_response_byte_limit as i32,
        &token_hash,
    )
    .await?;
    Ok(AuditJobReference {
        audit_id,
        job_id,
        canonical_url: canonical.into_string(),
        access_token,
    })
}

pub fn hash_access_token(token: &str) -> String {
    let digest = Sha256::digest(token.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}
