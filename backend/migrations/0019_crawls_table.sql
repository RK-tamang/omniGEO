-- Crawl/scan results table for public and authenticated scans
CREATE TABLE IF NOT EXISTS crawls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed')),
    format TEXT NOT NULL DEFAULT 'markdown',
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    error TEXT,
    pages_crawled INTEGER DEFAULT 0 CHECK(pages_crawled>=0),
    credits_used INTEGER DEFAULT 0 CHECK(credits_used>=0),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX crawls_url_idx ON crawls(url);
CREATE INDEX crawls_status_idx ON crawls(status);
CREATE INDEX crawls_created_at_idx ON crawls(created_at DESC);
