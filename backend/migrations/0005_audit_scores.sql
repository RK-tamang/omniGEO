CREATE TABLE audit_scores (
    audit_run_id UUID PRIMARY KEY REFERENCES audit_runs(id) ON DELETE CASCADE,
    overall_score SMALLINT NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
    technical_score SMALLINT NOT NULL CHECK (technical_score BETWEEN 0 AND 100),
    metadata_score SMALLINT NOT NULL CHECK (metadata_score BETWEEN 0 AND 100),
    structure_score SMALLINT NOT NULL CHECK (structure_score BETWEEN 0 AND 100),
    schema_score SMALLINT NOT NULL CHECK (schema_score BETWEEN 0 AND 100),
    links_score SMALLINT NOT NULL CHECK (links_score BETWEEN 0 AND 100),
    confidence SMALLINT NOT NULL CHECK (confidence BETWEEN 0 AND 100),
    methodology_version TEXT NOT NULL,
    limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
