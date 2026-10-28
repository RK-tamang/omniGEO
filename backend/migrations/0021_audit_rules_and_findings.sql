-- Technical GEO Audit Engine: rules, findings, scores, opportunities, evidence
DO $$ BEGIN
    CREATE TYPE audit_rule_status AS ENUM ('pass', 'fail', 'warning', 'skipped', 'unavailable');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    CREATE TYPE audit_finding_severity AS ENUM ('info', 'low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Rule definitions (versioned, configurable)
DROP TABLE IF EXISTS audit_rules CASCADE;
CREATE TABLE audit_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id TEXT NOT NULL,
    rule_version INTEGER NOT NULL DEFAULT 1,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    base_weight REAL NOT NULL DEFAULT 1.0 CHECK (base_weight >= 0.0),
    severity_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(rule_id, rule_version)
);

-- Rule evaluation results per audit run
DROP TABLE IF EXISTS audit_rule_results CASCADE;
CREATE TABLE audit_rule_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL,
    rule_version INTEGER NOT NULL DEFAULT 1,
    category TEXT NOT NULL,
    status audit_rule_status NOT NULL,
    severity audit_finding_severity,
    confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    penalty_contribution REAL NOT NULL DEFAULT 0.0 CHECK (penalty_contribution >= 0.0),
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    message TEXT NOT NULL,
    explanation TEXT,
    recommended_fix TEXT,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(audit_run_id, rule_id, rule_version)
);
CREATE INDEX IF NOT EXISTS audit_rule_results_run_idx ON audit_rule_results(audit_run_id);
CREATE INDEX IF NOT EXISTS audit_rule_results_rule_idx ON audit_rule_results(rule_id);

-- Structured findings (one per affected URL/element)
DROP TABLE IF EXISTS audit_findings CASCADE;
CREATE TABLE audit_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL,
    rule_version INTEGER NOT NULL DEFAULT 1,
    category TEXT NOT NULL,
    status audit_rule_status NOT NULL,
    severity audit_finding_severity NOT NULL,
    affected_url TEXT,
    affected_element TEXT,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    message TEXT NOT NULL,
    explanation TEXT,
    recommended_fix TEXT,
    confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    fingerprint TEXT NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(fingerprint)
);
CREATE INDEX IF NOT EXISTS audit_findings_run_idx ON audit_findings(audit_run_id);
CREATE INDEX IF NOT EXISTS audit_findings_rule_idx ON audit_findings(rule_id);
CREATE INDEX IF NOT EXISTS audit_findings_severity_idx ON audit_findings(audit_run_id, severity);

-- Category-level scores per audit run
CREATE TABLE IF NOT EXISTS audit_score_categories (
    audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    score SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
    weight REAL NOT NULL CHECK (weight >= 0.0),
    rules_passed INTEGER NOT NULL DEFAULT 0,
    rules_failed INTEGER NOT NULL DEFAULT 0,
    rules_unavailable INTEGER NOT NULL DEFAULT 0,
    coverage REAL NOT NULL DEFAULT 0.0 CHECK (coverage >= 0.0 AND coverage <= 1.0),
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (audit_run_id, category)
);
CREATE INDEX IF NOT EXISTS audit_score_categories_run_idx ON audit_score_categories(audit_run_id);

-- Evidence snapshots (store minimal evidence for historical reports)
CREATE TABLE IF NOT EXISTS audit_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    finding_id UUID REFERENCES audit_findings(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    evidence_type TEXT NOT NULL,
    evidence_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_evidence_run_idx ON audit_evidence(audit_run_id);
CREATE INDEX IF NOT EXISTS audit_evidence_finding_idx ON audit_evidence(finding_id);

-- Actionable opportunities converted from findings
CREATE TABLE IF NOT EXISTS audit_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    explanation TEXT NOT NULL,
    category TEXT NOT NULL,
    severity audit_finding_severity NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    estimated_effort TEXT NOT NULL CHECK (estimated_effort IN ('small', 'medium', 'large')),
    confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'ignored')),
    affected_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    related_finding_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    suggested_fix TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_opportunities_run_idx ON audit_opportunities(audit_run_id);
CREATE INDEX IF NOT EXISTS audit_opportunities_status_idx ON audit_opportunities(audit_run_id, status);
