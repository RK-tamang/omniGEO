CREATE TABLE organization_report_entitlements (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    reports_enabled BOOLEAN NOT NULL DEFAULT false,
    monthly_export_limit INTEGER NOT NULL DEFAULT 0 CHECK(monthly_export_limit>=0),
    max_artifact_bytes BIGINT NOT NULL DEFAULT 25000000 CHECK(max_artifact_bytes BETWEEN 1024 AND 250000000),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE reports ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE reports ADD COLUMN source_snapshot_sha256 TEXT;
ALTER TABLE export_usage_events ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX export_usage_org_created_idx ON export_usage_events(organization_id,created_at DESC) WHERE organization_id IS NOT NULL;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE reports ADD CONSTRAINT reports_status_check CHECK(status IN ('queued','running','completed','failed','canceled','expired'));
