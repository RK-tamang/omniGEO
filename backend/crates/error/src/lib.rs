//! Shared error model for the AnswerScope HTTP API and worker boundaries.
//!
//! Every API error is mapped to a stable machine code, a safe human message and
//! the correlation ID of the current request. Internal details are logged but
//! never returned to clients.

use std::fmt;
use std::future::Future;

use axum::{
    Json,
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::Serialize;
use utoipa::ToSchema;

tokio::task_local! {
    static REQUEST_ID: String;
}

/// Run a request future with a correlation ID available to the error model.
pub async fn with_request_id<F>(request_id: String, future: F) -> F::Output
where
    F: Future,
{
    REQUEST_ID.scope(request_id, future).await
}

/// Current request correlation ID, when running inside `with_request_id`.
pub fn current_request_id() -> Option<String> {
    REQUEST_ID.try_with(Clone::clone).ok()
}

/// Stable, documented API error codes.
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    Validation(String),
    #[error("resource not found")]
    NotFound,
    #[error("authentication is required")]
    Unauthorized,
    #[error("access is forbidden")]
    Forbidden,
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    TooManyRequests(String),
    #[error("{0}")]
    ServiceUnavailable(String),
    #[error("internal server error")]
    Internal(#[from] anyhow::Error),
}

impl ApiError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::BadRequest(_) => "invalid_request",
            Self::Validation(_) => "validation_error",
            Self::NotFound => "not_found",
            Self::Unauthorized => "unauthorized",
            Self::Forbidden => "forbidden",
            Self::Conflict(_) => "conflict",
            Self::TooManyRequests(_) => "rate_limited",
            Self::ServiceUnavailable(_) => "service_unavailable",
            Self::Internal(_) => "internal_error",
        }
    }

    pub fn status(&self) -> StatusCode {
        match self {
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Validation(_) => StatusCode::UNPROCESSABLE_ENTITY,
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::Forbidden => StatusCode::FORBIDDEN,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::TooManyRequests(_) => StatusCode::TOO_MANY_REQUESTS,
            Self::ServiceUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn public_message(&self) -> String {
        match self {
            Self::BadRequest(message)
            | Self::Validation(message)
            | Self::Conflict(message)
            | Self::TooManyRequests(message)
            | Self::ServiceUnavailable(message) => message.clone(),
            Self::NotFound => "The requested resource does not exist.".to_owned(),
            Self::Unauthorized => "Valid authentication credentials are required.".to_owned(),
            Self::Forbidden => "You do not have access to this resource.".to_owned(),
            Self::Internal(_) => "An unexpected error occurred.".to_owned(),
        }
    }
}

/// Consistent JSON error envelope.
///
/// `error` and `message` intentionally carry the same human-readable text for
/// backwards compatibility with existing API clients; `code` is the stable
/// value clients should branch on.
#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorEnvelope {
    /// Stable machine-readable error code.
    pub code: String,
    /// Human-readable, non-sensitive message.
    pub error: String,
    /// Human-readable, non-sensitive message.
    pub message: String,
    /// HTTP status code repeated in the body for easy client handling.
    pub status: u16,
    /// Correlation ID for this request.
    #[schema(nullable = true)]
    pub request_id: Option<String>,
}

impl fmt::Display for ErrorEnvelope {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status();
        let code = self.code();
        let request_id = current_request_id();

        if let Self::Internal(error) = &self {
            tracing::error!(
                error = %error,
                error_code = code,
                request_id = request_id.as_deref().unwrap_or("-"),
                "unhandled API error"
            );
        } else if status.is_server_error() {
            tracing::error!(
                error_code = code,
                request_id = request_id.as_deref().unwrap_or("-"),
                "API service unavailable"
            );
        }

        let message = self.public_message();
        let body = ErrorEnvelope {
            code: code.to_owned(),
            error: message.clone(),
            message,
            status: status.as_u16(),
            request_id: request_id.clone(),
        };
        let mut response = (status, Json(body)).into_response();
        if let Some(request_id) = request_id {
            if let Ok(value) = HeaderValue::from_str(&request_id) {
                response.headers_mut().insert("x-request-id", value);
            }
        }
        response.headers_mut().insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        );
        response
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_validation_errors_to_422() {
        let error = ApiError::Validation("url is invalid".into());
        assert_eq!(error.status(), StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(error.code(), "validation_error");
    }

    #[test]
    fn internal_errors_do_not_expose_details() {
        let error = ApiError::Internal(anyhow::anyhow!("password=super-secret"));
        assert_eq!(error.status(), StatusCode::INTERNAL_SERVER_ERROR);
        assert!(!error.public_message().contains("super-secret"));
        assert_eq!(error.public_message(), "An unexpected error occurred.");
    }

    #[tokio::test]
    async fn error_envelope_contains_request_id() {
        let response = with_request_id("req-test-12345678".to_owned(), async {
            ApiError::NotFound.into_response()
        })
        .await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_eq!(
            response
                .headers()
                .get("x-request-id")
                .and_then(|value| value.to_str().ok()),
            Some("req-test-12345678")
        );
    }
}
