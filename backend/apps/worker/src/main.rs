use std::time::Duration;

use answerscope_api::{config::Config, crawler::worker};
use answerscope_observability::{init_tracing, shutdown_signal};
use answerscope_persistence::{DatabaseSettings, connect, migrate};
use sqlx::PgPool;
use tokio::{
    sync::watch,
    task::JoinSet,
    time::{Instant, timeout},
};
use tracing::{error, info, warn};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env()?;
    init_tracing("answerscope_worker", config.log_format)?;

    info!(
        service = env!("CARGO_PKG_NAME"),
        version = env!("CARGO_PKG_VERSION"),
        environment = %config.environment,
        database = %config.database_target(),
        "starting AnswerScope worker"
    );

    let settings = DatabaseSettings::from_config(&config, "answerscope-worker");
    let pool = connect(&settings).await?;
    migrate(&pool).await?;
    info!("database migrations applied");

    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let mut tasks: JoinSet<anyhow::Result<()>> = JoinSet::new();

    {
        let pool = pool.clone();
        let config = config.clone();
        let shutdown = shutdown_rx.clone();
        let worker_id = format!("worker-{}", std::process::id());
        tasks.spawn(async move { worker::run_forever(pool, config, worker_id, shutdown).await });
    }

    {
        let pool = pool.clone();
        let shutdown = shutdown_rx.clone();
        tasks.spawn(visibility_loop(pool, shutdown));
    }
    {
        let pool = pool.clone();
        let shutdown = shutdown_rx.clone();
        tasks.spawn(billing_loop(pool, shutdown));
    }
    {
        let pool = pool.clone();
        let config = config.clone();
        let shutdown = shutdown_rx.clone();
        tasks.spawn(email_loop(pool, config, shutdown));
    }

    shutdown_signal().await;
    info!("shutdown signal received; stopping worker loops");

    if shutdown_tx.send(true).is_err() {
        warn!("worker shutdown channel closed before signal");
    }

    let deadline = Instant::now() + Duration::from_secs(config.shutdown_timeout_secs);
    while !tasks.is_empty() {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            warn!(
                timeout_secs = config.shutdown_timeout_secs,
                "worker shutdown deadline reached; aborting remaining tasks"
            );
            tasks.abort_all();
            break;
        }
        match timeout(remaining, tasks.join_next()).await {
            Ok(Some(Ok(Ok(())))) => {}
            Ok(Some(Ok(Err(error)))) => error!(%error, "worker task stopped with an error"),
            Ok(Some(Err(error))) if error.is_cancelled() => {}
            Ok(Some(Err(error))) => error!(%error, "worker task panicked"),
            Ok(None) => break,
            Err(_) => {
                warn!("worker shutdown deadline reached while waiting for tasks");
                tasks.abort_all();
                break;
            }
        }
    }

    match timeout(
        Duration::from_secs(config.shutdown_timeout_secs),
        pool.close(),
    )
    .await
    {
        Ok(()) => info!("database pool closed"),
        Err(_) => warn!("database pool close exceeded shutdown deadline"),
    }
    info!("AnswerScope worker stopped");
    Ok(())
}

async fn visibility_loop(
    pool: PgPool,
    mut shutdown: watch::Receiver<bool>,
) -> anyhow::Result<()> {
    let worker_id = format!("visibility-{}", std::process::id());
    loop {
        if *shutdown.borrow() {
            return Ok(());
        }
        match answerscope_api::visibility::process_next(&pool, &worker_id).await {
            Ok(true) => continue,
            Ok(false) => {
                if sleep_or_shutdown(&mut shutdown, Duration::from_secs(2)).await {
                    return Ok(());
                }
            }
            Err(error) => {
                error!(%error, "visibility worker loop error");
                if sleep_or_shutdown(&mut shutdown, Duration::from_secs(5)).await {
                    return Ok(());
                }
            }
        }
    }
}

async fn billing_loop(pool: PgPool, mut shutdown: watch::Receiver<bool>) -> anyhow::Result<()> {
    loop {
        if *shutdown.borrow() {
            return Ok(());
        }
        if let Err(error) = answerscope_api::billing::process_due(&pool).await {
            error!(%error, "billing lifecycle worker error");
        }
        if sleep_or_shutdown(&mut shutdown, Duration::from_secs(60)).await {
            return Ok(());
        }
    }
}

async fn email_loop(
    pool: PgPool,
    config: Config,
    mut shutdown: watch::Receiver<bool>,
) -> anyhow::Result<()> {
    let worker_id = format!("email-{}", std::process::id());
    loop {
        if *shutdown.borrow() {
            return Ok(());
        }
        match answerscope_api::notifications::process_email_next(&pool, &config, &worker_id).await {
            Ok(true) => continue,
            Ok(false) => {
                if sleep_or_shutdown(&mut shutdown, Duration::from_secs(5)).await {
                    return Ok(());
                }
            }
            Err(error) => {
                error!(%error, "email outbox worker error");
                if sleep_or_shutdown(&mut shutdown, Duration::from_secs(10)).await {
                    return Ok(());
                }
            }
        }
    }
}

/// Wait for the next iteration or for shutdown. Returns true when shutting down.
async fn sleep_or_shutdown(shutdown: &mut watch::Receiver<bool>, duration: Duration) -> bool {
    tokio::select! {
        _ = tokio::time::sleep(duration) => false,
        changed = shutdown.changed() => changed.is_err() || *shutdown.borrow(),
    }
}
