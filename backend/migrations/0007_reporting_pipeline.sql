ALTER TABLE reports ADD COLUMN report_type TEXT NOT NULL DEFAULT 'geo_audit';
ALTER TABLE reports ADD COLUMN status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','canceled'));
ALTER TABLE reports ADD COLUMN content_type TEXT;
ALTER TABLE reports ADD COLUMN byte_size BIGINT;
ALTER TABLE reports ADD COLUMN checksum_sha256 TEXT;
ALTER TABLE reports ADD COLUMN source_snapshot JSONB;
ALTER TABLE reports ADD COLUMN failure_reason TEXT;
ALTER TABLE reports ADD COLUMN completed_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN retained_until TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days');

CREATE TABLE audit_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX audit_access_tokens_active_idx ON audit_access_tokens(audit_run_id,expires_at) WHERE revoked_at IS NULL;

CREATE TABLE report_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','canceled')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lease_expires_at TIMESTAMPTZ,
    locked_by TEXT,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX report_jobs_claim_idx ON report_jobs(status,available_at) WHERE status='queued';

CREATE TABLE report_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL,
    byte_size BIGINT NOT NULL CHECK(byte_size >= 0),
    checksum_sha256 TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    retained_until TIMESTAMPTZ NOT NULL
);
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    report_type TEXT NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(name,report_type)
);
CREATE TABLE export_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    format TEXT NOT NULL CHECK(format IN ('json','csv','pdf')),
    byte_size BIGINT NOT NULL CHECK(byte_size >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX export_usage_audit_created_idx ON export_usage_events(audit_run_id,created_at DESC);
