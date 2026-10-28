//! Shared DataForSEO HTTP client with HTTP Basic authentication.

use reqwest::Client;
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;

/// Shared authenticated DataForSEO client.
#[derive(Clone)]
pub struct DataForSeoClient {
    inner: Client,
    login: String,
    password: String,
    base_url: String,
    timeout_secs: u64,
}

impl DataForSeoClient {
    pub fn new(login: String, password: String, base_url: String, timeout_secs: u64) -> Self {
        let inner = Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .user_agent("AnswerScope/0.1 (+https://answerscope.ai)")
            .build()
            .expect("DataForSEO reqwest client builds");
        Self {
            inner,
            login,
            password,
            base_url,
            timeout_secs,
        }
    }

    pub fn login(&self) -> &str {
        &self.login
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// POST a JSON body to a DataForSEO endpoint with Basic auth.
    pub async fn post_json(&self, path: &str, body: &Value) -> reqwest::Result<reqwest::Response> {
        let url = format!("{}{}", self.base_url, path);
        self.inner
            .post(&url)
            .basic_auth(&self.login, Some(&self.password))
            .json(body)
            .send()
            .await
    }

    /// GET a DataForSEO endpoint with Basic auth.
    pub async fn get(&self, path: &str) -> reqwest::Result<reqwest::Response> {
        let url = format!("{}{}", self.base_url, path);
        self.inner
            .get(&url)
            .basic_auth(&self.login, Some(&self.password))
            .send()
            .await
    }
}
