//! Environment configuration is owned by the shared `answerscope-config` crate
//! so the API and worker validate exactly the same values.

pub use answerscope_config::{Config, Environment, LogFormat};
