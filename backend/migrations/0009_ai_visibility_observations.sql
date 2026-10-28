CREATE TABLE ai_providers (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    max_concurrency INTEGER NOT NULL DEFAULT 1 CHECK(max_concurrency BETWEEN 1 AND 100),
    max_requests_per_minute INTEGER NOT NULL DEFAULT 30 CHECK(max_requests_per_minute BETWEEN 1 AND 10000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE ai_provider_capabilities (
    provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
    engine TEXT NOT NULL,
    surface TEXT NOT NULL,
    country TEXT NOT NULL,
    language TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY(provider_id, surface, country, language)
);
INSERT INTO ai_providers(id,display_name) VALUES ('dataforseo_chatgpt_search','DataForSEO ChatGPT Search') ON CONFLICT DO NOTHING;
INSERT INTO ai_provider_capabilities(provider_id,engine,surface,country,language) VALUES
('dataforseo_chatgpt_search','ChatGPT','chatgpt_search','US','en'),
('dataforseo_chatgpt_search','ChatGPT','chatgpt_search','GB','en'),
('dataforseo_chatgpt_search','ChatGPT','chatgpt_search','CA','en'),
('dataforseo_chatgpt_search','ChatGPT','chatgpt_search','AU','en') ON CONFLICT DO NOTHING;

CREATE TABLE prompt_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL, theme TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(project_id,name)
);
CREATE TABLE tracked_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    group_id UUID REFERENCES prompt_groups(id) ON DELETE SET NULL, exact_prompt TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'US', language TEXT NOT NULL DEFAULT 'en', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','archived')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id,exact_prompt,country,language)
);
CREATE INDEX tracked_prompts_project_status_idx ON tracked_prompts(project_id,status,created_at DESC);
CREATE TABLE project_brand_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    alias TEXT NOT NULL, is_primary BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(project_id,alias)
);
CREATE TABLE project_competitor_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    competitor_name TEXT NOT NULL, alias TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(project_id,alias)
);
CREATE TABLE organization_visibility_entitlements (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false, tracked_prompt_limit INTEGER NOT NULL DEFAULT 0 CHECK(tracked_prompt_limit>=0),
    monthly_observation_limit INTEGER NOT NULL DEFAULT 0 CHECK(monthly_observation_limit>=0),
    monthly_spend_limit_microusd BIGINT NOT NULL DEFAULT 0 CHECK(monthly_spend_limit_microusd>=0), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE visibility_credit_accounts (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    balance_microusd BIGINT NOT NULL DEFAULT 0 CHECK(balance_microusd>=0), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE visibility_credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    amount_microusd BIGINT NOT NULL CHECK(amount_microusd<>0), reason TEXT NOT NULL,
    observation_job_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE observation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, prompt_id UUID NOT NULL REFERENCES tracked_prompts(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL REFERENCES ai_providers(id), engine TEXT NOT NULL, surface TEXT NOT NULL,
    country TEXT NOT NULL, language TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','canceled')),
    idempotency_key TEXT NOT NULL, reservation_microusd BIGINT NOT NULL CHECK(reservation_microusd>0),
    attempts INTEGER NOT NULL DEFAULT 0, available_at TIMESTAMPTZ NOT NULL DEFAULT now(), lease_expires_at TIMESTAMPTZ,
    locked_by TEXT, last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), started_at TIMESTAMPTZ,
    provider_request_started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX observation_jobs_org_idempotency_idx ON observation_jobs(organization_id,idempotency_key);
CREATE INDEX observation_jobs_claim_idx ON observation_jobs(status,available_at) WHERE status='queued';
CREATE INDEX observation_jobs_org_created_idx ON observation_jobs(organization_id,created_at DESC);
CREATE TABLE visibility_usage_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_id UUID NOT NULL UNIQUE REFERENCES observation_jobs(id) ON DELETE CASCADE, reserved_microusd BIGINT NOT NULL,
    settled_microusd BIGINT, status TEXT NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','settled','released')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), settled_at TIMESTAMPTZ
);
ALTER TABLE visibility_credit_ledger ADD CONSTRAINT visibility_credit_ledger_job_fk FOREIGN KEY(observation_job_id) REFERENCES observation_jobs(id) ON DELETE SET NULL;

CREATE TABLE ai_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, prompt_id UUID NOT NULL REFERENCES tracked_prompts(id) ON DELETE CASCADE,
    job_id UUID NOT NULL UNIQUE REFERENCES observation_jobs(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL REFERENCES ai_providers(id), engine TEXT NOT NULL, surface TEXT NOT NULL,
    country TEXT NOT NULL, language TEXT NOT NULL, requested_at TIMESTAMPTZ NOT NULL, collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL CHECK(status IN ('complete','incomplete')), answer_text TEXT NOT NULL, raw_response JSONB NOT NULL,
    raw_result_reference TEXT, retrieval_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    provider_cost_microusd BIGINT CHECK(provider_cost_microusd IS NULL OR provider_cost_microusd>=0),
    limitations JSONB NOT NULL DEFAULT '[]'::jsonb, is_consumer_search_observation BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX ai_observations_project_date_idx ON ai_observations(project_id,collected_at DESC);
CREATE INDEX ai_observations_provider_surface_idx ON ai_observations(project_id,provider_id,surface,collected_at DESC);
CREATE TABLE observation_citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), observation_id UUID NOT NULL REFERENCES ai_observations(id) ON DELETE CASCADE,
    url TEXT NOT NULL, title TEXT, source_domain TEXT, citation_type TEXT NOT NULL DEFAULT 'provider_reported', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(observation_id,url)
);
CREATE INDEX observation_citations_domain_idx ON observation_citations(source_domain);
CREATE TABLE observation_entity_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), observation_id UUID NOT NULL REFERENCES ai_observations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, matched_alias TEXT NOT NULL,
    entity_kind TEXT NOT NULL CHECK(entity_kind IN ('brand','competitor')), confidence NUMERIC(5,4) NOT NULL DEFAULT 1.0,
    evidence_excerpt TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(observation_id,matched_alias,entity_kind)
);
CREATE TABLE ai_monitoring_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, cadence TEXT NOT NULL CHECK(cadence IN ('daily','weekly','custom')),
    enabled BOOLEAN NOT NULL DEFAULT true, next_run_at TIMESTAMPTZ NOT NULL, configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE provider_cost_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES observation_jobs(id) ON DELETE CASCADE, provider_id TEXT NOT NULL REFERENCES ai_providers(id),
    estimated_microusd BIGINT NOT NULL, actual_microusd BIGINT, currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL CHECK(status IN ('estimated','settled','uncertain','released')), credit_shortfall_microusd BIGINT NOT NULL DEFAULT 0 CHECK(credit_shortfall_microusd>=0), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), settled_at TIMESTAMPTZ,
    UNIQUE(job_id)
);
