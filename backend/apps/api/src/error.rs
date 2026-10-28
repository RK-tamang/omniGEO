//! Shared API error model. Consumers import `ApiError` from this module while
//! the implementation lives in the `answerscope-error` crate.

pub use answerscope_error::{ApiError, ErrorEnvelope, current_request_id, with_request_id};
