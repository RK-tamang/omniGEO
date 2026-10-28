//! Crawl persistence layer.
//! PostgreSQL-backed storage for crawl jobs, pages, links, fingerprints,
//! and cache entries.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

/// A stored crawl page record.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StoredCrawlPage {
    pub id: Uuid,
    pub crawl_run_id: Uuid,
    pub organization_id: Uuid,
    pub project_id: Uuid,
    pub requested_url: String,
    pub final_url: String,
    pub canonical_url: String,
    pub fetch_provider: String,
    pub http_status: i32,
    pub content_type: Option<String>,
    pub fetched_at: chrono::DateTime<chrono::Utc>,
    pub duration_ms: i64,
    pub redirect_chain: Vec<String>,
    pub metadata: serde_json::Value,
    pub headings: serde_json::Value,
    pub main_content: Option<String>,
    pub links: serde_json::Value,
    pub images: serde_json::Value,
    pub structured_data: Vec<serde_json::Value>,
    pub brand_signals: serde_json::Value,
    pub content_fingerprint: String,
    pub extraction_version: String,
    pub extraction_quality: Option<f64>,
    pub error_status: Option<String>,
}

/// A stored crawl job record.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StoredCrawlJob {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub project_id: Uuid,
    pub root_url: String,
    pub mode: String,
    pub status: String,
    pub pages_discovered: i32,
    pub pages_fetched: i32,
    pub pages_failed: i32,
    pub total_bytes: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub error_message: Option<String>,
}

/// Persist a crawl page to the database.
pub async fn store_crawl_page(
    pool: &PgPool,
    page: &crate::domain::PageRecord,
    crawl_run_id: Uuid,
    organization_id: Uuid,
    project_id: Uuid,
) -> Result<Uuid, Box<dyn std::error::Error + Send + Sync>> {
    let id = page.id;
    sqlx::query(
        r#"
        INSERT INTO crawl_pages (
            id, crawl_run_id, organization_id, project_id,
            requested_url, final_url, canonical_url, fetch_provider,
            http_status, content_type, fetched_at, duration_ms,
            redirect_chain, metadata, headings, main_content,
            links, images, structured_data, brand_signals,
            content_fingerprint, extraction_version, extraction_quality,
            error_status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
        "#,
    )
    .bind(id)
    .bind(crawl_run_id)
    .bind(organization_id)
    .bind(project_id)
    .bind(&page.requested_url)
    .bind(&page.final_url)
    .bind(&page.canonical_url)
    .bind(&format!("{:?}", page.fetch_provider))
    .bind(page.http_status as i32)
    .bind(&page.content_type)
    .bind(page.fetched_at)
    .bind(page.duration_ms as i64)
    .bind(&page.redirect_chain)
    .bind(&page.metadata)
    .bind(serde_json::to_string(&page.headings).unwrap_or_default())
    .bind(&page.main_content)
    .bind(serde_json::to_string(&page.links).unwrap_or_default())
    .bind(serde_json::to_string(&page.images).unwrap_or_default())
    .bind(&page.structured_data)
    .bind(&page.brand_signals)
    .bind(&page.content_fingerprint)
    .bind(&page.extraction_version)
    .bind(page.extraction_quality)
    .bind(&page.error_status)
    .execute(pool)
    .await?;

    Ok(id)
}

/// Persist crawl page links as a batch.
pub async fn store_crawl_links(
    pool: &PgPool,
    crawl_run_id: Uuid,
    source_url: &str,
    links: &[crate::domain::LinkRecord],
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    for link in links {
        sqlx::query(
            r#"
            INSERT INTO crawl_links (
                crawl_run_id, source_url, target_url, is_internal,
                is_nofollow, is_sponsored, is_ugc, rel, anchor_text
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(crawl_run_id)
        .bind(source_url)
        .bind(&link.url)
        .bind(link.is_internal)
        .bind(link.is_nofollow)
        .bind(link.is_sponsored)
        .bind(link.is_ugc)
        .bind(&link.rel)
        .bind(&link.anchor_text)
        .execute(pool)
        .await?;
    }
    Ok(())
}

/// Store content fingerprint for deduplication.
pub async fn store_content_fingerprint(
    pool: &PgPool,
    crawl_run_id: Uuid,
    url: &str,
    fingerprint: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    sqlx::query(
        r#"
        INSERT INTO content_fingerprints (crawl_run_id, url, fingerprint, created_at)
        VALUES ($1,$2,$3,now())
        ON CONFLICT (crawl_run_id, fingerprint) DO NOTHING
        "#,
    )
    .bind(crawl_run_id)
    .bind(url)
    .bind(fingerprint)
    .execute(pool)
    .await?;
    Ok(())
}

/// Record crawl cache entry.
pub async fn store_crawl_cache(
    pool: &PgPool,
    canonical_url: &str,
    body_hash: &str,
    body: &[u8],
    content_type: Option<&str>,
    expires_at: chrono::DateTime<chrono::Utc>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    sqlx::query(
        r#"
        INSERT INTO fetch_cache (canonical_url, body_hash, body, content_type, fetched_at, expires_at)
        VALUES ($1,$2,$3,$4,now(),$5)
        ON CONFLICT (canonical_url) DO UPDATE SET
            body_hash = EXCLUDED.body_hash,
            body = EXCLUDED.body,
            content_type = EXCLUDED.content_type,
            fetched_at = now(),
            expires_at = EXCLUDED.expires_at
        "#,
    )
    .bind(canonical_url)
    .bind(body_hash)
    .bind(body)
    .bind(content_type)
    .bind(expires_at)
    .execute(pool)
    .await?;
    Ok(())
}

/// Lookup crawl cache entry.
pub async fn lookup_crawl_cache(
    pool: &PgPool,
    canonical_url: &str,
) -> Result<Option<(Vec<u8>, String, Option<String>)>, Box<dyn std::error::Error + Send + Sync>> {
    let row: Option<(Vec<u8>, String, Option<String>)> = sqlx::query_as(
        "SELECT body, content_type, body_hash FROM fetch_cache WHERE canonical_url=$1 AND expires_at>now()",
    )
    .bind(canonical_url)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

/// Create or update a crawl job record.
pub async fn upsert_crawl_job(
    pool: &PgPool,
    job: &crate::domain::CrawlJob,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    sqlx::query(
        r#"
        INSERT INTO crawl_jobs_ext (
            id, organization_id, project_id, root_url, mode,
            status, pages_discovered, pages_fetched, pages_failed,
            total_bytes, created_at, completed_at, error_message
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            pages_discovered = EXCLUDED.pages_discovered,
            pages_fetched = EXCLUDED.pages_fetched,
            pages_failed = EXCLUDED.pages_failed,
            total_bytes = EXCLUDED.total_bytes,
            completed_at = EXCLUDED.completed_at,
            error_message = EXCLUDED.error_message
        "#,
    )
    .bind(job.id)
    .bind(job.organization_id)
    .bind(job.project_id)
    .bind(&job.root_url)
    .bind(&format!("{:?}", job.mode))
    .bind(&job.status)
    .bind(job.pages_discovered)
    .bind(job.pages_fetched)
    .bind(job.pages_failed)
    .bind(job.total_bytes)
    .bind(job.created_at)
    .bind(job.completed_at)
    .bind(&job.error_message)
    .execute(pool)
    .await?;

    Ok(())
}

/// List crawl jobs with optional filters.
pub async fn list_crawl_jobs(
    pool: &PgPool,
    organization_id: Uuid,
    limit: i64,
    offset: i64,
) -> Result<Vec<StoredCrawlJob>, Box<dyn std::error::Error + Send + Sync>> {
    let rows = sqlx::query_as::<_, StoredCrawlJob>(
        "SELECT * FROM crawl_jobs_ext WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(organization_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Get a crawl job by ID.
pub async fn get_crawl_job(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<StoredCrawlJob>, Box<dyn std::error::Error + Send + Sync>> {
    let row: Option<StoredCrawlJob> = sqlx::query_as("SELECT * FROM crawl_jobs_ext WHERE id=$1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

/// List pages for a crawl run.
pub async fn list_crawl_pages(
    pool: &PgPool,
    crawl_run_id: Uuid,
    limit: i64,
    offset: i64,
) -> Result<Vec<StoredCrawlPage>, Box<dyn std::error::Error + Send + Sync>> {
    let rows = sqlx::query_as::<_, StoredCrawlPage>(
        "SELECT * FROM crawl_pages WHERE crawl_run_id=$1 ORDER BY fetched_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(crawl_run_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Check if a URL has already been crawled in this run.
pub async fn is_url_crawled(
    pool: &PgPool,
    crawl_run_id: Uuid,
    url: &str,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM crawl_pages WHERE crawl_run_id=$1 AND canonical_url=$2",
    )
    .bind(crawl_run_id)
    .bind(url)
    .fetch_one(pool)
    .await?;
    Ok(count > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_structure_is_valid() {
        // Persistence module compiles and exports expected types.
        let _ = StoredCrawlPage {
            id: Uuid::new_v4(),
            crawl_run_id: Uuid::new_v4(),
            organization_id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            requested_url: String::new(),
            final_url: String::new(),
            canonical_url: String::new(),
            fetch_provider: String::new(),
            http_status: 200,
            content_type: None,
            fetched_at: chrono::Utc::now(),
            duration_ms: 0,
            redirect_chain: Vec::new(),
            metadata: serde_json::json!({}),
            headings: Vec::new(),
            main_content: None,
            links: Vec::new(),
            images: Vec::new(),
            structured_data: Vec::new(),
            brand_signals: serde_json::json!({}),
            content_fingerprint: String::new(),
            extraction_version: String::new(),
            extraction_quality: None,
            error_status: None,
        };
    }
}
