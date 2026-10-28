-- Citations & Sources: customer-owned domain verification and competitor profiles
-- These tables support ownership classification of cited domains.

-- Customer-owned verified domains for a project
CREATE TABLE IF NOT EXISTS project_verified_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, domain)
);
CREATE INDEX project_verified_domains_project_idx ON project_verified_domains(project_id);
CREATE INDEX project_verified_domains_domain_idx ON project_verified_domains(domain);

-- Competitor profiles with associated domains
CREATE TABLE IF NOT EXISTS competitor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    competitor_name TEXT NOT NULL,
    domain TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, competitor_name)
);
CREATE INDEX competitor_profiles_project_idx ON competitor_profiles(project_id);
CREATE INDEX competitor_profiles_domain_idx ON competitor_profiles(domain);

-- Citation domain aggregates (incremental, idempotent)
CREATE TABLE IF NOT EXISTS citation_domain_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    ownership TEXT NOT NULL CHECK(ownership IN ('customer_owned','competitor_owned','third_party','unknown')),
    citing_observations INTEGER NOT NULL DEFAULT 0 CHECK(citing_observations >= 0),
    unique_cited_urls INTEGER NOT NULL DEFAULT 0 CHECK(unique_cited_urls >= 0),
    unique_prompts INTEGER NOT NULL DEFAULT 0 CHECK(unique_prompts >= 0),
    engines JSONB NOT NULL DEFAULT '[]'::jsonb,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, domain, period_start, period_end)
);
CREATE INDEX citation_domain_aggregates_project_period_idx ON citation_domain_aggregates(project_id, period_start DESC, period_end DESC);
CREATE INDEX citation_domain_aggregates_ownership_idx ON citation_domain_aggregates(project_id, ownership, last_seen DESC);

-- Citation page aggregates
CREATE TABLE IF NOT EXISTS citation_page_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    domain TEXT NOT NULL,
    ownership TEXT NOT NULL CHECK(ownership IN ('customer_owned','competitor_owned','third_party','unknown')),
    title TEXT,
    citing_observations INTEGER NOT NULL DEFAULT 0 CHECK(citing_observations >= 0),
    unique_prompts INTEGER NOT NULL DEFAULT 0 CHECK(unique_prompts >= 0),
    engines JSONB NOT NULL DEFAULT '[]'::jsonb,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, normalized_url, period_start, period_end)
);
CREATE INDEX citation_page_aggregates_project_period_idx ON citation_page_aggregates(project_id, period_start DESC, period_end DESC);
CREATE INDEX citation_page_aggregates_domain_idx ON citation_page_aggregates(project_id, domain, last_seen DESC);

-- Citation gap snapshots
CREATE TABLE IF NOT EXISTS citation_gap_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    prompt_id UUID NOT NULL REFERENCES tracked_prompts(id) ON DELETE CASCADE,
    prompt_text TEXT NOT NULL,
    engine TEXT NOT NULL,
    competitor_name TEXT NOT NULL,
    competitor_domain TEXT,
    competitor_url TEXT,
    customer_cited BOOLEAN NOT NULL DEFAULT false,
    priority TEXT NOT NULL CHECK(priority IN ('high','medium','low')) DEFAULT 'medium',
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX citation_gap_snapshots_project_period_idx ON citation_gap_snapshots(project_id, period_start DESC, period_end DESC);
CREATE INDEX citation_gap_snapshots_priority_idx ON citation_gap_snapshots(project_id, priority, observed_at DESC);

-- Optimization tasks linked to citation gaps
CREATE TABLE IF NOT EXISTS citation_optimization_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    gap_id UUID REFERENCES citation_gap_snapshots(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    explanation TEXT NOT NULL,
    priority TEXT NOT NULL CHECK(priority IN ('high','medium','low')) DEFAULT 'medium',
    status TEXT NOT NULL CHECK(status IN ('open','in_progress','resolved','ignored')) DEFAULT 'open',
    supporting_observations JSONB NOT NULL DEFAULT '[]'::jsonb,
    assigned_owner UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX citation_optimization_tasks_project_idx ON citation_optimization_tasks(project_id, created_at DESC);
CREATE INDEX citation_optimization_tasks_status_idx ON citation_optimization_tasks(project_id, status);

-- Comment for documentation
COMMENT ON TABLE project_verified_domains IS 'Customer-owned verified domains used for citation ownership classification.';
COMMENT ON TABLE competitor_profiles IS 'Competitor profiles with associated domains for citation gap analysis.';
COMMENT ON TABLE citation_domain_aggregates IS 'Incremental domain-level citation aggregates for fast dashboard reads.';
COMMENT ON TABLE citation_page_aggregates IS 'Incremental page-level citation aggregates for fast dashboard reads.';
COMMENT ON TABLE citation_gap_snapshots IS 'Evidence-backed competitor citation gap snapshots.';
COMMENT ON TABLE citation_optimization_tasks IS 'Optimization tasks created from citation gaps.';
