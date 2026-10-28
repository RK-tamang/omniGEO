//! HTTP handlers are split into domain modules as the API surface grows.
//! Route composition lives in `routes`; reusable business logic remains in services.
pub mod reports;
pub mod system;
