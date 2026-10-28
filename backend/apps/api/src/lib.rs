//! AnswerScope's modular monolith. HTTP handlers are deliberately thin; the
//! free audit engine can be reused by the API process and the worker process.

pub mod admin;
pub mod auth;
pub mod billing;
pub mod config;
pub mod crawler;
pub mod dataforseo_routes;
pub mod error;
pub mod geo_audit;
pub mod handlers;
pub mod integrations;
pub mod middleware;
pub mod models;
pub mod notifications;
pub mod openapi;
pub mod repositories;
pub mod routes;
pub mod services;
pub mod state;
pub mod visibility;
pub mod workspace;
