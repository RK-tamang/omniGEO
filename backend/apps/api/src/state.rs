use std::time::Instant;

use chrono::{DateTime, Utc};
use sqlx::PgPool;

use crate::config::Config;

/// Shared process state. Each binary owns exactly one instance behind an `Arc`.
#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
    pub started_at: DateTime<Utc>,
    pub started_instant: Instant,
}

impl AppState {
    pub fn new(pool: PgPool, config: Config) -> Self {
        Self {
            pool,
            config,
            started_at: Utc::now(),
            started_instant: Instant::now(),
        }
    }

    pub fn uptime_seconds(&self) -> u64 {
        self.started_instant.elapsed().as_secs()
    }
}
