//! PostgreSQL connectivity, pool policy and migration validation.

pub mod audits;

use std::{str::FromStr, time::Duration, time::Instant};

use answerscope_config::Config;
use sqlx::{
    PgPool,
    migrate::Migrator,
    postgres::{PgConnectOptions, PgPoolOptions},
};

/// Migrations are compiled into the binary so the API and worker always run
/// against the schema version they were built with.
pub static MIGRATOR: Migrator = sqlx::migrate!("../../migrations");

/// Connection policy shared by the API and worker processes.
#[derive(Clone, Debug)]
pub struct DatabaseSettings {
    pub url: String,
    pub max_connections: u32,
    pub connect_timeout: Duration,
    pub acquire_timeout: Duration,
    pub application_name: String,
}

impl DatabaseSettings {
    pub fn from_config(config: &Config, application_name: impl Into<String>) -> Self {
        Self {
            url: config.database_url.clone(),
            max_connections: config.database_max_connections,
            connect_timeout: Duration::from_secs(config.database_connect_timeout_secs),
            acquire_timeout: Duration::from_secs(config.database_acquire_timeout_secs),
            application_name: application_name.into(),
        }
    }
}

/// Open a bounded PostgreSQL pool. Errors contain no credentials.
pub async fn connect(settings: &DatabaseSettings) -> anyhow::Result<PgPool> {
    let options = PgConnectOptions::from_str(&settings.url)
        .map_err(|_| anyhow::anyhow!("DATABASE_URL contains an unsupported PostgreSQL URL"))?
        .application_name(&settings.application_name);
    PgPoolOptions::new()
        .max_connections(settings.max_connections)
        .min_connections(0)
        .acquire_timeout(settings.acquire_timeout)
        .idle_timeout(Duration::from_secs(600))
        .max_lifetime(Duration::from_secs(1_800))
        .connect_with(options)
        .await
        .map_err(|_| anyhow::anyhow!("failed to connect to PostgreSQL"))
}

/// Open a pool without waiting for a connection. Used by tests and tools that
/// must construct an application router before PostgreSQL is available.
pub fn connect_lazy(settings: &DatabaseSettings) -> anyhow::Result<PgPool> {
    let options = PgConnectOptions::from_str(&settings.url)
        .map_err(|_| anyhow::anyhow!("DATABASE_URL contains an unsupported PostgreSQL URL"))?
        .application_name(&settings.application_name);
    Ok(PgPoolOptions::new()
        .max_connections(settings.max_connections)
        .min_connections(0)
        .acquire_timeout(settings.acquire_timeout)
        .connect_lazy_with(options))
}

/// Apply all embedded migrations. SQLx records applied versions and is safe to
/// run on every boot.
pub async fn migrate(pool: &PgPool) -> anyhow::Result<()> {
    MIGRATOR
        .run(pool)
        .await
        .map_err(|error| anyhow::anyhow!("database migration failed: {error}"))?;
    Ok(())
}

/// Readiness failure with a safe public code.
#[derive(Debug, thiserror::Error)]
pub enum ReadinessError {
    #[error("database readiness check timed out")]
    Timeout,
    #[error("database readiness check failed")]
    Query(#[source] sqlx::Error),
    #[error("database readiness check returned an unexpected result")]
    UnexpectedResult,
}

impl ReadinessError {
    /// Stable code safe to expose in readiness responses and logs.
    pub fn code(&self) -> &'static str {
        match self {
            Self::Timeout => "database_timeout",
            Self::Query(_) => "database_unavailable",
            Self::UnexpectedResult => "database_invalid_response",
        }
    }
}

/// Execute a real PostgreSQL round trip with a hard deadline.
///
/// This intentionally acquires a pooled connection and runs `SELECT 1`; a
/// process with a disconnected or exhausted pool reports not-ready.
pub async fn ping(pool: &PgPool, timeout: Duration) -> Result<u64, ReadinessError> {
    let started = Instant::now();
    let query = sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(pool);
    match tokio::time::timeout(timeout, query).await {
        Ok(Ok(1)) => Ok(started.elapsed().as_millis() as u64),
        Ok(Ok(_)) => Err(ReadinessError::UnexpectedResult),
        Ok(Err(error)) => Err(ReadinessError::Query(error)),
        Err(_) => Err(ReadinessError::Timeout),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn readiness_ping_fails_for_unreachable_database() {
        let settings = DatabaseSettings {
            url: "postgres://postgres:postgres@127.0.0.1:1/answerscope".to_owned(),
            max_connections: 1,
            connect_timeout: Duration::from_millis(250),
            acquire_timeout: Duration::from_millis(250),
            application_name: "answerscope-readiness-test".to_owned(),
        };
        let pool = connect_lazy(&settings).expect("lazy pool");
        let error = ping(&pool, Duration::from_millis(500))
            .await
            .expect_err("unreachable database must fail readiness");
        assert!(matches!(
            error,
            ReadinessError::Query(_) | ReadinessError::Timeout
        ));
        assert!(!error.code().is_empty());
        pool.close().await;
    }

    #[test]
    fn readiness_codes_are_stable() {
        assert_eq!(ReadinessError::Timeout.code(), "database_timeout");
        assert_eq!(
            ReadinessError::UnexpectedResult.code(),
            "database_invalid_response"
        );
    }
}
