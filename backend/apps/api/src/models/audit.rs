use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

pub use answerscope_api_contracts::{AuditJobReference, AuditSubmission};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditRecord {
    pub id: Uuid,
    pub requested_url: String,
    pub canonical_url: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub failure_reason: Option<String>,
}
