use std::{sync::Arc, time::Duration};

use answerscope_api::{config::Config, routes, state::AppState};
use answerscope_observability::{init_tracing, shutdown_signal};
use answerscope_persistence::{DatabaseSettings, connect, migrate};
use tokio::net::TcpListener;
use tracing::{error, info, warn};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env()?;
    init_tracing("answerscope_api", config.log_format)?;

    info!(
        service = env!("CARGO_PKG_NAME"),
        version = env!("CARGO_PKG_VERSION"),
        environment = %config.environment,
        database = %config.database_target(),
        "starting AnswerScope API"
    );

    let settings = DatabaseSettings::from_config(&config, "answerscope-api");
    let pool = connect(&settings).await?;
    migrate(&pool).await?;
    info!("database migrations applied");

    let state = Arc::new(AppState::new(pool.clone(), config.clone()));
    let listener = TcpListener::bind(config.bind_addr).await?;
    let address = listener.local_addr()?;
    info!(%address, api_version = answerscope_api_contracts::API_VERSION, "AnswerScope API listening");

    let shutdown_timeout = Duration::from_secs(config.shutdown_timeout_secs);
    axum::serve(listener, routes::router(state))
        .with_graceful_shutdown(async {
            shutdown_signal().await;
            info!("shutdown signal received; draining connections");
        })
        .await?;

    match tokio::time::timeout(shutdown_timeout, pool.close()).await {
        Ok(()) => info!("database pool closed"),
        Err(_) => warn!(
            timeout_secs = shutdown_timeout.as_secs(),
            "database pool close exceeded shutdown deadline"
        ),
    }
    info!("AnswerScope API stopped");
    Ok(())
}
