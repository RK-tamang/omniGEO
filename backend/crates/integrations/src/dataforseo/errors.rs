//! DataForSEO-specific error types.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum DataForSeoError {
    #[error("DataForSEO is not configured: {0}")]
    NotConfigured(String),
    #[error("DataForSEO authentication failed: {0}")]
    AuthFailed(String),
    #[error("DataForSEO quota exceeded")]
    QuotaExceeded,
    #[error("DataForSEO request failed: {0}")]
    Request(String),
    #[error("DataForSEO response could not be normalized: {0}")]
    InvalidResponse(String),
    #[error("DataForSEO task not ready: {0}")]
    NotReady(String),
    #[error("DataForSEO task expired: {0}")]
    Expired(String),
    #[error("DataForSEO insufficient credits: {0}")]
    InsufficientCredits(String),
    #[error("DataForSEO budget ceiling exceeded: {0}")]
    BudgetCeiling(String),
}

impl From<DataForSeoError> for answerscope_ai_visibility::ProviderError {
    fn from(e: DataForSeoError) -> Self {
        match e {
            DataForSeoError::NotConfigured(s) => answerscope_ai_visibility::ProviderError::NotConfigured(s),
            DataForSeoError::QuotaExceeded => answerscope_ai_visibility::ProviderError::QuotaExceeded,
            DataForSeoError::Request(s) => answerscope_ai_visibility::ProviderError::Request(s),
            DataForSeoError::InvalidResponse(s) => answerscope_ai_visibility::ProviderError::InvalidResponse(s),
            DataForSeoError::AuthFailed(s) => answerscope_ai_visibility::ProviderError::NotConfigured(s),
            DataForSeoError::NotReady(s) => answerscope_ai_visibility::ProviderError::Request(s),
            DataForSeoError::Expired(s) => answerscope_ai_visibility::ProviderError::Request(s),
            DataForSeoError::InsufficientCredits(s) => answerscope_ai_visibility::ProviderError::Request(s),
            DataForSeoError::BudgetCeiling(s) => answerscope_ai_visibility::ProviderError::Request(s),
        }
    }
}
