//! Environment-backed configuration shared by the AnswerScope API and worker.
//!
//! Configuration is parsed and validated once at process start. Invalid values
//! fail fast with an actionable error that never includes a secret value.

use std::{
    collections::BTreeMap,
    env,
    fmt,
    net::SocketAddr,
    path::PathBuf,
    str::FromStr,
};

use anyhow::{Context, Result, bail};
use url::Url;

/// Deployment environment. Drives secure defaults such as cookie handling.
#[derive(Clone, Copy, Debug, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    Development,
    Test,
    Staging,
    Production,
}

impl Environment {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Development => "development",
            Self::Test => "test",
            Self::Staging => "staging",
            Self::Production => "production",
        }
    }

    pub fn is_production(self) -> bool {
        matches!(self, Self::Production)
    }
}

impl fmt::Display for Environment {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl FromStr for Environment {
    type Err = anyhow::Error;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "development" | "dev" => Ok(Self::Development),
            "test" | "testing" => Ok(Self::Test),
            "staging" => Ok(Self::Staging),
            "production" | "prod" => Ok(Self::Production),
            _ => bail!("APP_ENV must be one of development, test, staging, or production"),
        }
    }
}

/// Structured log output format.
#[derive(Clone, Copy, Debug, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogFormat {
    Json,
    Pretty,
}

impl LogFormat {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Json => "json",
            Self::Pretty => "pretty",
        }
    }
}

impl fmt::Display for LogFormat {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl FromStr for LogFormat {
    type Err = anyhow::Error;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "json" => Ok(Self::Json),
            "pretty" | "text" => Ok(Self::Pretty),
            _ => bail!("LOG_FORMAT must be either json or pretty"),
        }
    }
}

/// Validated process configuration.
#[derive(Clone)]
pub struct Config {
    pub bind_addr: SocketAddr,
    pub database_url: String,
    pub database_max_connections: u32,
    pub environment: Environment,
    pub log_format: LogFormat,
    pub database_connect_timeout_secs: u64,
    pub database_acquire_timeout_secs: u64,
    pub readiness_timeout_ms: u64,
    pub shutdown_timeout_secs: u64,
    pub crawl_page_limit: usize,
    pub crawl_max_depth: usize,
    pub crawl_response_byte_limit: usize,
    pub crawl_min_request_interval_ms: u64,
    pub crawl_request_timeout_secs: u64,
    pub crawl_max_redirects: usize,
    pub crawl_cache_ttl_secs: u64,
    pub pagespeed_api_key: Option<String>,
    pub google_oauth_client_id: Option<String>,
    pub google_oauth_client_secret: Option<String>,
    pub report_storage_dir: PathBuf,
    pub report_anonymous_monthly_limit: i64,
    pub billing_manual_settlement_secret: Option<String>,
    pub billing_manual_payment_instructions: String,
    pub billing_invoice_due_days: i64,
    pub workos_client_id: Option<String>,
    pub workos_api_key: Option<String>,
    pub workos_redirect_uri: String,
    pub app_base_url: String,
    pub auth_cookie_secure: bool,
    pub resend_api_key: Option<String>,
    pub email_from: String,
    pub frontend_origin: String,
    pub dataforseo_login: Option<String>,
    pub dataforseo_password: Option<String>,
    pub dataforseo_estimated_cost_micro_usd: Option<i64>,
    pub dataforseo_max_concurrent_requests: u32,
    pub dataforseo_max_batch_tasks: u32,
    pub dataforseo_request_timeout_secs: u64,
    pub dataforseo_monthly_budget_usd: f64,
    pub dataforseo_daily_budget_usd: f64,
    pub dataforseo_cache_ttl_secs: u64,
}

impl fmt::Debug for Config {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("Config")
            .field("bind_addr", &self.bind_addr)
            .field("database_url", &self.database_url_redacted())
            .field("database_max_connections", &self.database_max_connections)
            .field("environment", &self.environment)
            .field("log_format", &self.log_format)
            .field("database_connect_timeout_secs", &self.database_connect_timeout_secs)
            .field("database_acquire_timeout_secs", &self.database_acquire_timeout_secs)
            .field("readiness_timeout_ms", &self.readiness_timeout_ms)
            .field("shutdown_timeout_secs", &self.shutdown_timeout_secs)
            .field("crawl_page_limit", &self.crawl_page_limit)
            .field("crawl_max_depth", &self.crawl_max_depth)
            .field("crawl_response_byte_limit", &self.crawl_response_byte_limit)
            .field("crawl_min_request_interval_ms", &self.crawl_min_request_interval_ms)
            .field("crawl_request_timeout_secs", &self.crawl_request_timeout_secs)
            .field("crawl_max_redirects", &self.crawl_max_redirects)
            .field("crawl_cache_ttl_secs", &self.crawl_cache_ttl_secs)
            .field("pagespeed_api_key_configured", &self.pagespeed_api_key.is_some())
            .field(
                "google_oauth_client_id_configured",
                &self.google_oauth_client_id.is_some(),
            )
            .field(
                "google_oauth_client_secret_configured",
                &self.google_oauth_client_secret.is_some(),
            )
            .field("report_storage_dir", &self.report_storage_dir)
            .field(
                "report_anonymous_monthly_limit",
                &self.report_anonymous_monthly_limit,
            )
            .field(
                "billing_manual_settlement_secret_configured",
                &self.billing_manual_settlement_secret.is_some(),
            )
            .field("billing_invoice_due_days", &self.billing_invoice_due_days)
            .field("workos_client_id_configured", &self.workos_client_id.is_some())
            .field("workos_api_key_configured", &self.workos_api_key.is_some())
            .field("workos_redirect_uri", &self.workos_redirect_uri)
            .field("app_base_url", &self.app_base_url)
            .field("auth_cookie_secure", &self.auth_cookie_secure)
            .field("resend_api_key_configured", &self.resend_api_key.is_some())
            .field("email_from", &self.email_from)
            .field("frontend_origin", &self.frontend_origin)
            .field("dataforseo_login_configured", &self.dataforseo_login.is_some())
            .field("dataforseo_password_configured", &self.dataforseo_password.is_some())
            .field(
                "dataforseo_estimated_cost_micro_usd_configured",
                &self.dataforseo_estimated_cost_micro_usd.is_some(),
            )
            .field("dataforseo_max_concurrent_requests", &self.dataforseo_max_concurrent_requests)
            .field("dataforseo_max_batch_tasks", &self.dataforseo_max_batch_tasks)
            .field("dataforseo_request_timeout_secs", &self.dataforseo_request_timeout_secs)
            .field("dataforseo_monthly_budget_usd", &self.dataforseo_monthly_budget_usd)
            .field("dataforseo_daily_budget_usd", &self.dataforseo_daily_budget_usd)
            .field("dataforseo_cache_ttl_secs", &self.dataforseo_cache_ttl_secs)
            .finish()
    }
}

impl Config {
    /// Load `.env` (when present) and validate the process environment.
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();
        Self::from_vars(env::vars())
    }

    /// Parse configuration from an explicit key/value source.
    ///
    /// This is public so binary entry points and tests exercise exactly the same
    /// validation without mutating process-global environment variables.
    pub fn from_vars<I, K, V>(vars: I) -> Result<Self>
    where
        I: IntoIterator<Item = (K, V)>,
        K: Into<String>,
        V: Into<String>,
    {
        let vars: BTreeMap<String, String> = vars
            .into_iter()
            .map(|(key, value)| (key.into(), value.into()))
            .collect();
        let get = |key: &str| vars.get(key).map(String::as_str);

        let environment: Environment = parse_or(get("APP_ENV"), Environment::Development)?;
        let log_format: LogFormat = parse_or(get("LOG_FORMAT"), LogFormat::Json)?;
        let bind_addr: SocketAddr = parse_or(
            get("API_BIND_ADDR"),
            "0.0.0.0:8080".parse().expect("static bind address"),
        )?;
        let database_url = get("DATABASE_URL")
            .filter(|value| !value.trim().is_empty())
            .context("DATABASE_URL is required")?
            .to_owned();
        validate_database_url(&database_url)?;

        let database_max_connections = bounded_u64(
            "DATABASE_MAX_CONNECTIONS",
            parse_or(get("DATABASE_MAX_CONNECTIONS"), 10)?,
            1,
            100,
        )? as u32;
        let database_connect_timeout_secs = bounded_u64(
            "DB_CONNECT_TIMEOUT_SECS",
            parse_or(get("DB_CONNECT_TIMEOUT_SECS"), 10)?,
            1,
            300,
        )?;
        let database_acquire_timeout_secs = bounded_u64(
            "DB_ACQUIRE_TIMEOUT_SECS",
            parse_or(get("DB_ACQUIRE_TIMEOUT_SECS"), 5)?,
            1,
            60,
        )?;
        let readiness_timeout_ms = bounded_u64(
            "READINESS_TIMEOUT_MS",
            parse_or(get("READINESS_TIMEOUT_MS"), 2_000)?,
            100,
            30_000,
        )?;
        let shutdown_timeout_secs = bounded_u64(
            "SHUTDOWN_TIMEOUT_SECS",
            parse_or(get("SHUTDOWN_TIMEOUT_SECS"), 30)?,
            1,
            300,
        )?;

        let frontend_origin = get("FRONTEND_ORIGIN")
            .unwrap_or("http://localhost:3000")
            .to_owned();
        validate_origin("FRONTEND_ORIGIN", &frontend_origin)?;
        let app_base_url = get("APP_BASE_URL")
            .unwrap_or("http://localhost:3000")
            .to_owned();
        validate_origin("APP_BASE_URL", &app_base_url)?;

        let pagespeed_api_key = non_empty(get("PAGESPEED_API_KEY"));
        let google_oauth_client_id = non_empty(get("GOOGLE_OAUTH_CLIENT_ID"));
        let google_oauth_client_secret = non_empty(get("GOOGLE_OAUTH_CLIENT_SECRET"));

        let crawl_page_limit = bounded_u64(
            "CRAWL_PAGE_LIMIT",
            parse_or(get("CRAWL_PAGE_LIMIT"), 50)?,
            1,
            10_000,
        )? as usize;
        let crawl_max_depth = bounded_u64(
            "CRAWL_MAX_DEPTH",
            parse_or(get("CRAWL_MAX_DEPTH"), 4)?,
            0,
            20,
        )? as usize;
        let crawl_response_byte_limit = bounded_u64(
            "CRAWL_RESPONSE_BYTE_LIMIT",
            parse_or(get("CRAWL_RESPONSE_BYTE_LIMIT"), 2_000_000)?,
            1_024,
            50_000_000,
        )? as usize;
        let crawl_min_request_interval_ms = bounded_u64(
            "CRAWL_MIN_REQUEST_INTERVAL_MS",
            parse_or(get("CRAWL_MIN_REQUEST_INTERVAL_MS"), 500)?,
            0,
            60_000,
        )?;
        let crawl_request_timeout_secs = bounded_u64(
            "CRAWL_REQUEST_TIMEOUT_SECS",
            parse_or(get("CRAWL_REQUEST_TIMEOUT_SECS"), 15)?,
            1,
            60,
        )?;
        let crawl_max_redirects = bounded_u64(
            "CRAWL_MAX_REDIRECTS",
            parse_or(get("CRAWL_MAX_REDIRECTS"), 5)?,
            0,
            10,
        )? as usize;
        let crawl_cache_ttl_secs = bounded_u64(
            "CRAWL_CACHE_TTL_SECS",
            parse_or(get("CRAWL_CACHE_TTL_SECS"), 300)?,
            0,
            3_600,
        )?;

        let report_anonymous_monthly_limit = bounded_u64(
            "REPORT_ANONYMOUS_MONTHLY_LIMIT",
            parse_or(get("REPORT_ANONYMOUS_MONTHLY_LIMIT"), 10)?,
            1,
            100,
        )? as i64;
        let billing_invoice_due_days = bounded_u64(
            "BILLING_INVOICE_DUE_DAYS",
            parse_or(get("BILLING_INVOICE_DUE_DAYS"), 14)?,
            1,
            90,
        )? as i64;

        let auth_cookie_secure = match get("AUTH_COOKIE_SECURE") {
            Some(value) => parse_bool("AUTH_COOKIE_SECURE", value)?,
            None => frontend_origin.starts_with("https://"),
        };

        Ok(Self {
            bind_addr,
            database_url,
            database_max_connections,
            environment,
            log_format,
            database_connect_timeout_secs,
            database_acquire_timeout_secs,
            readiness_timeout_ms,
            shutdown_timeout_secs,
            crawl_page_limit,
            crawl_max_depth,
            crawl_response_byte_limit,
            crawl_min_request_interval_ms,
            crawl_request_timeout_secs,
            crawl_max_redirects,
            crawl_cache_ttl_secs,
            pagespeed_api_key,
            google_oauth_client_id,
            google_oauth_client_secret,
            report_storage_dir: get("REPORT_STORAGE_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("./var/reports")),
            report_anonymous_monthly_limit,
            billing_manual_settlement_secret: non_empty(get("BILLING_MANUAL_SETTLEMENT_SECRET")),
            billing_manual_payment_instructions: get("BILLING_MANUAL_PAYMENT_INSTRUCTIONS")
                .unwrap_or(
                    "Payment is by invoice. Contact AnswerScope billing support for verified bank transfer instructions.",
                )
                .to_owned(),
            billing_invoice_due_days,
            workos_client_id: non_empty(get("WORKOS_CLIENT_ID")),
            workos_api_key: non_empty(get("WORKOS_API_KEY")),
            workos_redirect_uri: get("WORKOS_REDIRECT_URI")
                .unwrap_or("http://localhost:8080/api/v1/auth/workos/callback")
                .to_owned(),
            app_base_url,
            auth_cookie_secure,
            resend_api_key: non_empty(get("RESEND_API_KEY")),
            email_from: get("EMAIL_FROM")
                .unwrap_or("AnswerScope <no-reply@answerscope.example>")
                .to_owned(),
            frontend_origin,
            dataforseo_login: non_empty(get("DATAFORSEO_LOGIN")),
            dataforseo_password: non_empty(get("DATAFORSEO_PASSWORD")),
            dataforseo_estimated_cost_micro_usd: get("DATAFORSEO_ESTIMATED_COST_MICRO_USD")
                .and_then(|v| v.parse::<i64>().ok())
                .filter(|v| *v > 0),
            dataforseo_max_concurrent_requests = bounded_u32(
                "DATAFORSEO_MAX_CONCURRENT_REQUESTS",
                parse_or(get("DATAFORSEO_MAX_CONCURRENT_REQUESTS"), 4)?,
                1,
                64,
            )?,
            dataforseo_max_batch_tasks = bounded_u32(
                "DATAFORSEO_MAX_BATCH_TASKS",
                parse_or(get("DATAFORSEO_MAX_BATCH_TASKS"), 20)?,
                1,
                100,
            )?,
            dataforseo_request_timeout_secs = bounded_u64(
                "DATAFORSEO_REQUEST_TIMEOUT_SECONDS",
                parse_or(get("DATAFORSEO_REQUEST_TIMEOUT_SECONDS"), 130)?,
                10,
                300,
            )?,
            dataforseo_monthly_budget_usd = parse_or(get("DATAFORSEO_MONTHLY_BUDGET_USD"), 100.0)?,
            dataforseo_daily_budget_usd = parse_or(get("DATAFORSEO_DAILY_BUDGET_USD"), 10.0)?,
            dataforseo_cache_ttl_secs = bounded_u64(
                "DATAFORSEO_CACHE_TTL_SECONDS",
                parse_or(get("DATAFORSEO_CACHE_TTL_SECONDS"), 86400)?,
                60,
                604800,
            )?,
        })
    }

    /// Database connection target with credentials removed.
    pub fn database_url_redacted(&self) -> String {
        match Url::parse(&self.database_url) {
            Ok(mut url) => {
                if url.password().is_some() {
                    let _ = url.set_password(Some("***"));
                }
                url.to_string()
            }
            Err(_) => "<invalid database url>".to_owned(),
        }
    }

    /// Safe host/database summary suitable for structured logs.
    pub fn database_target(&self) -> String {
        match Url::parse(&self.database_url) {
            Ok(url) => format!(
                "{}:{}/{}",
                url.host_str().unwrap_or("<unknown>"),
                url.port_or_known_default().unwrap_or(5432),
                url.path().trim_start_matches('/')
            ),
            Err(_) => "<invalid database url>".to_owned(),
        }
    }
}

fn parse_or<T>(value: Option<&str>, default: T) -> Result<T>
where
    T: FromStr,
    T::Err: fmt::Display,
{
    match value {
        Some(raw) => raw
            .trim()
            .parse()
            .map_err(|error| anyhow::anyhow!("invalid configuration value: {error}")),
        None => Ok(default),
    }
}

fn bounded_u64(key: &str, value: u64, minimum: u64, maximum: u64) -> Result<u64> {
    if !(minimum..=maximum).contains(&value) {
        bail!("{key} must be between {minimum} and {maximum}");
    }
    Ok(value)
}

fn bounded_u32(key: &str, value: u32, minimum: u32, maximum: u32) -> Result<u32> {
    if !(minimum..=maximum).contains(&value) {
        bail!("{key} must be between {minimum} and {maximum}");
    }
    Ok(value)
}

fn parse_bool(key: &str, value: &str) -> Result<bool> {
    match value.trim().to_ascii_lowercase().as_str() {
        "true" | "1" | "yes" | "on" => Ok(true),
        "false" | "0" | "no" | "off" => Ok(false),
        _ => bail!("{key} must be true or false"),
    }
}

fn non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn validate_database_url(value: &str) -> Result<()> {
    let url = Url::parse(value).context("DATABASE_URL must be a valid PostgreSQL URL")?;
    if !matches!(url.scheme(), "postgres" | "postgresql") {
        bail!("DATABASE_URL must use the postgres or postgresql scheme");
    }
    if url.host_str().is_none() {
        bail!("DATABASE_URL must include a host");
    }
    if url.path().trim_matches('/').is_empty() {
        bail!("DATABASE_URL must include a database name");
    }
    Ok(())
}

fn validate_origin(key: &str, value: &str) -> Result<()> {
    let url = Url::parse(value).with_context(|| format!("{key} must be an absolute URL"))?;
    if !matches!(url.scheme(), "http" | "https") {
        bail!("{key} must use http or https");
    }
    if url.host_str().is_none() {
        bail!("{key} must include a host");
    }
    if url.query().is_some() || url.fragment().is_some() {
        bail!("{key} must not contain a query string or fragment");
    }
    if url.path() != "/" && !url.path().is_empty() {
        bail!("{key} must not contain a path");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_vars() -> BTreeMap<String, String> {
        BTreeMap::from([
            (
                "DATABASE_URL".to_owned(),
                "postgres://user:super-secret@localhost:5432/answerscope".to_owned(),
            ),
            ("APP_ENV".to_owned(), "test".to_owned()),
        ])
    }

    fn config(overrides: &[(&str, &str)]) -> Result<Config> {
        let mut vars = base_vars();
        for (key, value) in overrides {
            vars.insert((*key).to_owned(), (*value).to_owned());
        }
        Config::from_vars(vars)
    }

    #[test]
    fn parses_documented_defaults() {
        let config = config(&[]).expect("valid config");
        assert_eq!(config.bind_addr, "0.0.0.0:8080".parse().unwrap());
        assert_eq!(config.database_max_connections, 10);
        assert_eq!(config.environment, Environment::Test);
        assert_eq!(config.log_format, LogFormat::Json);
        assert_eq!(config.database_connect_timeout_secs, 10);
        assert_eq!(config.database_acquire_timeout_secs, 5);
        assert_eq!(config.readiness_timeout_ms, 2_000);
        assert_eq!(config.shutdown_timeout_secs, 30);
        assert_eq!(config.crawl_page_limit, 50);
        assert!(!config.auth_cookie_secure);
    }

    #[test]
    fn derives_secure_cookies_for_https_frontend() {
        let https = config(&[("FRONTEND_ORIGIN", "https://app.answerscope.example")]).unwrap();
        assert!(https.auth_cookie_secure);
        let overridden = config(&[
            ("FRONTEND_ORIGIN", "https://app.answerscope.example"),
            ("AUTH_COOKIE_SECURE", "false"),
        ])
        .unwrap();
        assert!(!overridden.auth_cookie_secure);
    }

    #[test]
    fn rejects_invalid_database_scheme() {
        let error = config(&[("DATABASE_URL", "mysql://localhost/answerscope")])
            .expect_err("invalid scheme must fail");
        assert!(error.to_string().contains("postgres"));
    }

    #[test]
    fn rejects_missing_database_url() {
        let vars = BTreeMap::from([("APP_ENV".to_owned(), "test".to_owned())]);
        let error = Config::from_vars(vars).expect_err("missing URL must fail");
        assert!(error.to_string().contains("DATABASE_URL"));
    }

    #[test]
    fn rejects_out_of_range_values() {
        let error = config(&[("DATABASE_MAX_CONNECTIONS", "0")]).expect_err("range must fail");
        assert!(error.to_string().contains("DATABASE_MAX_CONNECTIONS"));
        let error = config(&[("READINESS_TIMEOUT_MS", "10")]).expect_err("range must fail");
        assert!(error.to_string().contains("READINESS_TIMEOUT_MS"));
    }

    #[test]
    fn rejects_invalid_frontend_origin() {
        let error = config(&[("FRONTEND_ORIGIN", "not-a-url")]).expect_err("origin must fail");
        assert!(error.to_string().contains("FRONTEND_ORIGIN"));
        let error = config(&[("FRONTEND_ORIGIN", "https://example.test/path")])
            .expect_err("origin path must fail");
        assert!(error.to_string().contains("path"));
    }

    #[test]
    fn redacts_database_password_in_debug_and_summary() {
        let config = config(&[]).unwrap();
        let debug = format!("{config:?}");
        assert!(!debug.contains("super-secret"));
        assert!(debug.contains("***"));
        assert_eq!(
            config.database_target(),
            "localhost:5432/answerscope".to_owned()
        );
    }

    #[test]
    fn rejects_unknown_environment() {
        let error = config(&[("APP_ENV", "qa")]).expect_err("unknown environment must fail");
        assert!(error.to_string().contains("APP_ENV"));
    }
}
