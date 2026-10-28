-- Add missing code column to audit_findings table
-- The backend geo-audit engine expects a code column on audit_findings
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS code TEXT;

-- Also add a code column to audit_rules if missing (referenced by findings)
ALTER TABLE audit_rules ADD COLUMN IF NOT EXISTS code TEXT;

-- Backfill code from rule_id where code is null
UPDATE audit_findings SET code = rule_id WHERE code IS NULL;
UPDATE audit_rules SET code = rule_id WHERE code IS NULL;
