use serde::Serialize;
#[derive(Clone)]
pub struct GoogleOAuthConfig {
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub redirect_base_url: String,
}
#[derive(Serialize)]
pub struct IntegrationAvailability {
    pub provider: &'static str,
    pub configured: bool,
    pub status: &'static str,
    pub required_scopes: &'static [&'static str],
}
pub fn availability(config: &GoogleOAuthConfig) -> Vec<IntegrationAvailability> {
    let configured = config.client_id.is_some() && config.client_secret.is_some();
    vec![
        IntegrationAvailability {
            provider: "google_search_console",
            configured,
            status: if configured {
                "oauth_ready"
            } else {
                "disconnected"
            },
            required_scopes: &["https://www.googleapis.com/auth/webmasters.readonly"],
        },
        IntegrationAvailability {
            provider: "google_analytics_data",
            configured,
            status: if configured {
                "oauth_ready"
            } else {
                "disconnected"
            },
            required_scopes: &["https://www.googleapis.com/auth/analytics.readonly"],
        },
    ]
}
