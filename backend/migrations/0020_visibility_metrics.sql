CREATE TABLE visibility_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    engine TEXT NOT NULL,
    surface TEXT NOT NULL,
    observation_type TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    eligible_observations INTEGER NOT NULL CHECK(eligible_observations >= 0),
    brand_mentioned_observations INTEGER NOT NULL CHECK(brand_mentioned_observations >= 0),
    mention_rate NUMERIC(6,4) NOT NULL CHECK(mention_rate >= 0 AND mention_rate <= 100),
    domain_cited_observations INTEGER NOT NULL CHECK(domain_cited_observations >= 0),
    citation_rate NUMERIC(6,4) NOT NULL CHECK(citation_rate >= 0 AND citation_rate <= 100),
    recommendation_rate NUMERIC(6,4),
    share_of_voice NUMERIC(6,4),
    score_version TEXT NOT NULL DEFAULT '1.0',
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, project_id, engine, surface, observation_type, period_start, period_end)
);
CREATE INDEX visibility_metrics_project_period_idx ON visibility_metrics(project_id, period_start DESC, period_end DESC);
CREATE INDEX visibility_metrics_org_engine_idx ON visibility_metrics(organization_id, engine, calculated_at DESC);
