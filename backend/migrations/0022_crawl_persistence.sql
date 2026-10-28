-- Crawl persistence tables for the OmniGEO Crawl Engine (omnicrawl)
-- Supports Map, Scrape, Crawl, and Batch Scrape operations

-- Crawl pages store per-page extraction results
DROP VIEW IF EXISTS crawl_pages;
CREATE TABLE crawl_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crawl_run_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    project_id UUID NOT NULL,
    requested_url TEXT NOT NULL,
    final_url TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    fetch_provider TEXT NOT NULL DEFAULT 'native_rust',
    http_status INTEGER NOT NULL DEFAULT 200 CHECK(http_status >= 100 AND http_status < 600),
    content_type TEXT,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms BIGINT NOT NULL DEFAULT 0 CHECK(duration_ms >= 0),
    redirect_chain JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    headings JSONB NOT NULL DEFAULT '[]'::jsonb,
    main_content TEXT,
    links JSONB NOT NULL DEFAULT '[]'::jsonb,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    structured_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    brand_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    content_fingerprint TEXT NOT NULL,
    extraction_version TEXT NOT NULL DEFAULT '1.0.0',
    extraction_quality REAL CHECK(extraction_quality >= 0.0 AND extraction_quality <= 1.0),
    error_status TEXT
);

CREATE INDEX IF NOT EXISTS crawl_pages_run_idx ON crawl_pages(crawl_run_id);
CREATE INDEX IF NOT EXISTS crawl_pages_canonical_idx ON crawl_pages(canonical_url);
CREATE INDEX IF NOT EXISTS crawl_pages_fingerprint_idx ON crawl_pages(content_fingerprint);
CREATE INDEX IF NOT EXISTS crawl_pages_fetched_at_idx ON crawl_pages(fetched_at DESC);

-- Content fingerprints for deduplication across crawls
DROP TABLE IF EXISTS content_fingerprints CASCADE;
CREATE TABLE content_fingerprints (
    crawl_run_id UUID NOT NULL,
    url TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (crawl_run_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS content_fingerprints_lookup_idx ON content_fingerprints(fingerprint);

-- Fetch cache for HTTP response caching
DROP TABLE IF EXISTS fetch_cache CASCADE;
CREATE TABLE fetch_cache (
    canonical_url TEXT PRIMARY KEY,
    body_hash TEXT NOT NULL,
    body BYTEA NOT NULL,
    content_type TEXT,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS fetch_cache_expires_idx ON fetch_cache(expires_at);

-- Crawl jobs for tracking crawl operations (extends existing crawl_jobs table)
DROP TABLE IF EXISTS crawl_jobs_ext CASCADE;
CREATE TABLE crawl_jobs_ext (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    root_url TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'full_geo_crawl' CHECK(mode IN ('full_geo_crawl', 'quick_page', 'batch_scrape')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'running', 'completed', 'partially_completed', 'failed', 'cancelled')),
    pages_discovered INTEGER NOT NULL DEFAULT 0 CHECK(pages_discovered >= 0),
    pages_fetched INTEGER NOT NULL DEFAULT 0 CHECK(pages_fetched >= 0),
    pages_failed INTEGER NOT NULL DEFAULT 0 CHECK(pages_failed >= 0),
    total_bytes BIGINT NOT NULL DEFAULT 0 CHECK(total_bytes >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS crawl_jobs_ext_status_idx ON crawl_jobs_ext(status);
CREATE INDEX IF NOT EXISTS crawl_jobs_ext_org_idx ON crawl_jobs_ext(organization_id, created_at DESC);

-- Per-host rate limit state (in-memory in production, persisted for recovery)
DROP TABLE IF EXISTS host_rate_limits CASCADE;
CREATE TABLE host_rate_limits (
    host TEXT PRIMARY KEY,
    last_request TIMESTAMPTZ NOT NULL DEFAULT now(),
    min_interval_ms INTEGER NOT NULL DEFAULT 1000,
    consecutive_errors INTEGER NOT NULL DEFAULT 0 CHECK(consecutive_errors >= 0),
    backoff_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS host_rate_limits_backoff_idx ON host_rate_limits(backoff_until) WHERE backoff_until IS NOT NULL;
