ALTER TABLE crawled_pages ADD COLUMN depth INTEGER NOT NULL DEFAULT 0 CHECK (depth >= 0);
CREATE TABLE crawl_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    target_url TEXT NOT NULL,
    anchor_text TEXT,
    is_internal BOOLEAN NOT NULL,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(audit_run_id, source_url, target_url, anchor_text)
);
CREATE INDEX crawl_links_run_target_idx ON crawl_links(audit_run_id, target_url);
CREATE INDEX crawl_links_run_source_idx ON crawl_links(audit_run_id, source_url);
ALTER TABLE crawl_jobs ADD COLUMN cancel_requested_at TIMESTAMPTZ;
CREATE INDEX crawl_jobs_recovery_idx ON crawl_jobs(lease_expires_at) WHERE status = 'running';
