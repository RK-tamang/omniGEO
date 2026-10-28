use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderRequest {
    pub target: String,
    pub parameters: Value,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderObservation {
    pub provider_id: String,
    pub engine: Option<String>,
    pub response_status: String,
    pub payload: Value,
    pub limitations: Vec<String>,
}
#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("provider is not configured: {0}")]
    NotConfigured(String),
    #[error("provider quota exceeded")]
    QuotaExceeded,
    #[error("provider request failed: {0}")]
    Request(String),
    #[error("provider response could not be normalized: {0}")]
    InvalidResponse(String),
}
#[async_trait]
pub trait ProviderAdapter: Send + Sync {
    fn provider_id(&self) -> &'static str;
    fn supported_surfaces(&self) -> &'static [&'static str];
    async fn execute(&self, request: ProviderRequest)
    -> Result<ProviderObservation, ProviderError>;
}
pub struct UnconfiguredPremiumAdapter {
    pub id: &'static str,
}
#[async_trait]
impl ProviderAdapter for UnconfiguredPremiumAdapter {
    fn provider_id(&self) -> &'static str {
        self.id
    }
    fn supported_surfaces(&self) -> &'static [&'static str] {
        &[]
    }
    async fn execute(&self, _: ProviderRequest) -> Result<ProviderObservation, ProviderError> {
        Err(ProviderError::NotConfigured(self.id.into()))
    }
}
