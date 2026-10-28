//! DataForSEO configuration.

use std::sync::Arc;

/// DataForSEO runtime configuration loaded from environment.
#[derive(Clone, Debug)]
pub struct DataForSeoConfig {
    pub login: Option<String>,
    pub password: Option<String>,
    pub base_url: String,
    pub max_concurrent_requests: u32,
    pub max_batch_tasks: u32,
    pub request_timeout_secs: u64,
    pub monthly_budget_usd: f64,
    pub daily_budget_usd: f64,
    pub cache_ttl_secs: u64,
    pub estimated_cost_micro_usd: Option<i64>,
}

impl DataForSeoConfig {
    pub fn from_env() -> Self {
        Self {
            login: std::env::var("DATAFORSEO_LOGIN")
                .ok()
                .filter(|v| !v.trim().is_empty()),
            password: std::env::var("DATAFORSEO_PASSWORD")
                .ok()
                .filter(|v| !v.trim().is_empty()),
            base_url: std::env::var("DATAFORSEO_BASE_URL")
                .unwrap_or_else(|_| "https://api.dataforseo.com".to_owned()),
            max_concurrent_requests: std::env::var("DATAFORSEO_MAX_CONCURRENT_REQUESTS")
                .ok()
                .and_then(|v| v.parse::<u32>().ok())
                .unwrap_or(4),
            max_batch_tasks: std::env::var("DATAFORSEO_MAX_BATCH_TASKS")
                .ok()
                .and_then(|v| v.parse::<u32>().ok())
                .unwrap_or(20),
            request_timeout_secs: std::env::var("DATAFORSEO_REQUEST_TIMEOUT_SECONDS")
                .ok()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(130),
            monthly_budget_usd: std::env::var("DATAFORSEO_MONTHLY_BUDGET_USD")
                .ok()
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(100.0),
            daily_budget_usd: std::env::var("DATAFORSEO_DAILY_BUDGET_USD")
                .ok()
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(10.0),
            cache_ttl_secs: std::env::var("DATAFORSEO_CACHE_TTL_SECONDS")
                .ok()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(86400),
            estimated_cost_micro_usd: std::env::var("DATAFORSEO_ESTIMATED_COST_MICRO_USD")
                .ok()
                .and_then(|v| v.parse::<i64>().ok())
                .filter(|v| *v > 0),
        }
    }

    pub fn is_configured(&self) -> bool {
        self.login.is_some() && self.password.is_some()
    }

    pub fn shared(&self) -> crate::dataforseo::DataForSeoShared {
        let client = Arc::new(crate::dataforseo::client::DataForSeoClient::new(
            self.login.clone().unwrap_or_default(),
            self.password.clone().unwrap_or_default(),
            self.base_url.clone(),
            self.request_timeout_secs,
        ));
        let cost_tracker = Arc::new(crate::dataforseo::cost::DataForSeoCostTracker::new(
            self.monthly_budget_usd,
            self.daily_budget_usd,
        ));
        crate::dataforseo::DataForSeoShared {
            client,
            config: Arc::new(self.clone()),
            cost_tracker,
        }
    }
}

impl Default for DataForSeoConfig {
    fn default() -> Self {
        Self::from_env()
    }
}
