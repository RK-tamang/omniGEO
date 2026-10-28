-- Detailed crawl records complement the compact audit/result tables used by the API.
CREATE TABLE crawl_runs (
    audit_run_id UUID PRIMARY KEY REFERENCES audit_runs(id) ON DELETE CASCADE,
    crawler_version TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    pages_attempted INTEGER NOT NULL DEFAULT 0 CHECK (pages_attempted >= 0),
    pages_fetched INTEGER NOT NULL DEFAULT 0 CHECK (pages_fetched >= 0),
    excluded_by_robots INTEGER NOT NULL DEFAULT 0 CHECK (excluded_by_robots >= 0),
    coverage_notes JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE crawl_frontier (
    audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    depth INTEGER NOT NULL CHECK(depth >= 0),
    state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','in_progress','completed','robots_excluded','skipped')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(audit_run_id,url)
);
CREATE INDEX crawl_frontier_pending_idx ON crawl_frontier(audit_run_id,depth,url) WHERE state='queued';
-- Stable domain names for shared-engine consumers; the original API tables remain the
-- canonical storage to avoid duplicating existing crawl data.
CREATE VIEW crawl_pages AS SELECT * FROM crawled_pages;
CREATE VIEW page_links AS SELECT * FROM crawl_links;
CREATE TABLE fetch_cache (
    canonical_url TEXT PRIMARY KEY,
    status_code SMALLINT NOT NULL,
    final_url TEXT NOT NULL,
    content_type TEXT,
    body TEXT NOT NULL,
    x_robots_tag TEXT,
    redirect_chain JSONB NOT NULL DEFAULT '[]'::jsonb,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    CHECK (octet_length(body) <= 50000000)
);
CREATE INDEX fetch_cache_expiry_idx ON fetch_cache(expires_at);
ALTER TABLE crawled_pages ADD COLUMN redirect_chain JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE crawled_pages ADD COLUMN final_url TEXT;
CREATE OR REPLACE VIEW crawl_pages AS SELECT * FROM crawled_pages;

CREATE TABLE page_extractions (
    crawled_page_id UUID PRIMARY KEY REFERENCES crawled_pages(id) ON DELETE CASCADE,
    main_text TEXT NOT NULL DEFAULT '',
    extraction JSONB NOT NULL DEFAULT '{}'::jsonb,
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE content_fingerprints (
    crawled_page_id UUID PRIMARY KEY REFERENCES crawled_pages(id) ON DELETE CASCADE,
    audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    algorithm TEXT NOT NULL,
    normalized_hash TEXT NOT NULL,
    token_count INTEGER NOT NULL CHECK (token_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX content_fingerprints_run_hash_idx ON content_fingerprints(audit_run_id,normalized_hash);

CREATE TABLE audit_rule_versions (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    weights JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO audit_rule_versions(id,description,weights) VALUES
('geo-readiness-v1','Versioned evidence-based GEO readiness methodology; not observed AI visibility.',
 '{"technical":0.30,"metadata":0.20,"content_structure":0.20,"schema":0.15,"internal_links":0.15}'::jsonb)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE audit_scores ADD COLUMN crawl_budget_utilization SMALLINT NOT NULL DEFAULT 0 CHECK(crawl_budget_utilization BETWEEN 0 AND 100);
ALTER TABLE audit_scores ADD COLUMN evidence_categories JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE audit_findings
    ADD COLUMN analyzer_id TEXT NOT NULL DEFAULT 'geo_audit',
    ADD COLUMN analyzer_version TEXT NOT NULL DEFAULT '1.0.0',
    ADD COLUMN affected_url TEXT,
    ADD COLUMN evaluation_status TEXT NOT NULL DEFAULT 'evaluated' CHECK (evaluation_status IN ('evaluated','not_evaluated','unavailable','error')),
    ADD COLUMN documentation_reference TEXT;
CREATE INDEX audit_findings_analyzer_idx ON audit_findings(audit_run_id,analyzer_id,evaluation_status);

CREATE TABLE prompt_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    audit_run_id UUID REFERENCES audit_runs(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    category TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'deterministic_template',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id,prompt)
);

ALTER TABLE opportunities ADD COLUMN source_finding_id UUID REFERENCES audit_findings(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX opportunities_finding_unique_idx ON opportunities(audit_run_id,source_finding_id) WHERE source_finding_id IS NOT NULL;
