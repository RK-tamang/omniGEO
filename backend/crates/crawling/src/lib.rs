//! Unified website crawling and scraping engine for OmniGEO.
//!
//! Provides a secure, bounded, reusable crawler that powers the AnswerScope
//! GEO dashboard. Native Rust fetching is the default; Firecrawl is an
//! opt-in enhanced-extraction fallback.
//!
//! Module layout:
//!   domain      - CrawlRequest, CrawlResult, CrawlPolicy, CrawlBudget, PageRecord
//!   security    - URL validation, DNS policy, network policy, SSRF protection
//!   fetcher     - HTTP client, response streaming, redirect handling, error mapping
//!   discovery   - robots.txt, sitemap parsing, link discovery, URL frontier
//!   extraction  - HTML parsing, metadata, headings, main content, links, images,
//!                 structured data, brand signals, content fingerprinting
//!   providers   - native_rust adapter, Firecrawl adapter, provider selector
//!   orchestration - crawl planner, scheduler, progress tracking, cancellation, recovery
//!   persistence - crawl repository, page repository, extraction repository, cache repository
//!   api         - REST routes, handlers, DTOs
//!   tests       - unit and integration tests

pub mod api;
pub mod domain;
pub mod discovery;
pub mod extraction;
pub mod fetcher;
pub mod orchestration;
pub mod persistence;
pub mod providers;
pub mod security;

// Re-export key types for convenience.
pub use domain::*;
