CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TYPE audit_run_status AS ENUM ('queued', 'running', 'completed', 'partially_completed', 'failed');
CREATE TYPE job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'canceled');
CREATE TABLE organizations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE projects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE audit_runs (
 id UUID PRIMARY KEY, project_id UUID REFERENCES projects(id) ON DELETE SET NULL, requested_url TEXT NOT NULL, canonical_url TEXT NOT NULL,
 status audit_run_status NOT NULL, page_limit INTEGER NOT NULL CHECK (page_limit BETWEEN 1 AND 10000), byte_limit INTEGER NOT NULL CHECK (byte_limit BETWEEN 1024 AND 50000000),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, failure_reason TEXT
);
CREATE INDEX audit_runs_project_created_idx ON audit_runs(project_id, created_at DESC);
CREATE TABLE crawl_jobs (
 id UUID PRIMARY KEY, audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE, deduplication_key TEXT NOT NULL UNIQUE, status job_status NOT NULL DEFAULT 'queued', payload JSONB NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0), available_at TIMESTAMPTZ NOT NULL DEFAULT now(), lease_expires_at TIMESTAMPTZ, locked_by TEXT, last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ
);
CREATE INDEX crawl_jobs_claim_idx ON crawl_jobs(status, available_at) WHERE status = 'queued';
CREATE TABLE crawled_pages (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE, url TEXT NOT NULL, canonical_url TEXT, status_code INTEGER, content_type TEXT,
 title TEXT, meta_description TEXT, meta_robots TEXT, x_robots_tag TEXT, headings JSONB NOT NULL DEFAULT '[]'::jsonb, links JSONB NOT NULL DEFAULT '[]'::jsonb, structured_data JSONB NOT NULL DEFAULT '[]'::jsonb,
 content_hash TEXT, word_count INTEGER, fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (audit_run_id, url)
);
CREATE TABLE audit_findings (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE, code TEXT NOT NULL, severity TEXT NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
 title TEXT NOT NULL, evidence JSONB NOT NULL DEFAULT '{}'::jsonb, recommendation TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_findings_run_severity_idx ON audit_findings(audit_run_id, severity);
