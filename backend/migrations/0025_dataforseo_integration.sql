-- DataForSEO integration tables for durable task tracking, cost accounting,
-- and capability versioning. All tables are tenant-scoped via organization_id.

-- DataForSEO provider task records: one row per submitted provider task,
-- tracking the full task lifecycle from submission through settlement.
CREATE TABLE IF NOT EXISTS dataforseo_provider_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    observation_job_id UUID REFERENCES observation_jobs(id) ON DELETE SET NULL,
    provider_task_id TEXT NOT NULL,
    adapter_name TEXT NOT NULL,
    engine TEXT NOT NULL,
    surface TEXT NOT NULL,
    country TEXT NOT NULL,
    language TEXT NOT NULL,
    prompt TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'standard',
    status TEXT NOT NULL DEFAULT 'submitted', -- submitted, pending, completed, failed, cancelled, expired
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_payload JSONB,
    provider_cost_microusd BIGINT,
    estimated_cost_microusd BIGINT NOT NULL DEFAULT 0,
    actual_cost_microusd BIGINT,
    cost_currency TEXT NOT NULL DEFAULT 'USD',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    error_code TEXT,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dataforseo_provider_tasks_org_idx ON dataforseo_provider_tasks(organization_id);
CREATE INDEX IF NOT EXISTS dataforseo_provider_tasks_project_idx ON dataforseo_provider_tasks(project_id);
CREATE INDEX IF NOT EXISTS dataforseo_provider_tasks_job_idx ON dataforseo_provider_tasks(observation_job_id);
CREATE INDEX IF NOT EXISTS dataforseo_provider_tasks_task_id_idx ON dataforseo_provider_tasks(provider_task_id);
CREATE INDEX IF NOT EXISTS dataforseo_provider_tasks_status_idx ON dataforseo_provider_tasks(status);
CREATE INDEX IF NOT EXISTS dataforseo_provider_tasks_adapter_idx ON dataforseo_provider_tasks(adapter_name);
CREATE INDEX IF NOT EXISTS dataforseo_provider_tasks_submitted_at_idx ON dataforseo_provider_tasks(submitted_at);

-- DataForSEO task attempts: one row per submission attempt for retry tracking.
CREATE TABLE IF NOT EXISTS dataforseo_task_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES dataforseo_provider_tasks(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_payload JSONB,
    http_status_code INTEGER,
    error_code TEXT,
    error_message TEXT,
    cost_microusd BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dataforseo_task_attempts_task_idx ON dataforseo_task_attempts(task_id);

-- DataForSEO account usage: daily/monthly spend tracking per organization.
CREATE TABLE IF NOT EXISTS dataforseo_account_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start DATE NOT NULL DEFAULT CURRENT_DATE,
    period_end DATE NOT NULL DEFAULT CURRENT_DATE,
    total_requests INTEGER NOT NULL DEFAULT 0,
    successful_requests INTEGER NOT NULL DEFAULT 0,
    failed_requests INTEGER NOT NULL DEFAULT 0,
    total_cost_usd NUMERIC(12, 4) NOT NULL DEFAULT 0,
    total_cost_microusd BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, period_start)
);

CREATE INDEX IF NOT EXISTS dataforseo_account_usage_org_period_idx ON dataforseo_account_usage(organization_id, period_start);

-- DataForSEO cost events: authoritative per-task cost ledger.
CREATE TABLE IF NOT EXISTS dataforseo_cost_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES dataforseo_provider_tasks(id) ON DELETE SET NULL,
    provider_task_id TEXT,
    adapter_name TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'standard',
    estimated_microusd BIGINT NOT NULL DEFAULT 0,
    actual_microusd BIGINT,
    currency TEXT NOT NULL DEFAULT 'USD',
    settlement_status TEXT NOT NULL DEFAULT 'pending', -- pending, settled, released, refunded
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dataforseo_cost_events_org_idx ON dataforseo_cost_events(organization_id);
CREATE INDEX IF NOT EXISTS dataforseo_cost_events_project_idx ON dataforseo_cost_events(project_id);
CREATE INDEX IF NOT EXISTS dataforseo_cost_events_task_idx ON dataforseo_cost_events(task_id);
CREATE INDEX IF NOT EXISTS dataforseo_cost_events_status_idx ON dataforseo_cost_events(settlement_status);
CREATE INDEX IF NOT EXISTS dataforseo_cost_events_created_at_idx ON dataforseo_cost_events(created_at);

-- AI keyword estimates from DataForSEO AI Keyword Data.
CREATE TABLE IF NOT EXISTS ai_keyword_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES dataforseo_provider_tasks(id) ON DELETE SET NULL,
    keyword TEXT NOT NULL,
    market TEXT NOT NULL,
    language TEXT NOT NULL,
    ai_search_volume_estimate BIGINT,
    monthly_search_volume BIGINT,
    cpc_usd NUMERIC(10, 4),
    competition_level REAL,
    platform TEXT,
    source TEXT NOT NULL DEFAULT 'dataforseo',
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_keyword_estimates_org_idx ON ai_keyword_estimates(organization_id);
CREATE INDEX IF NOT EXISTS ai_keyword_estimates_project_idx ON ai_keyword_estimates(project_id);
CREATE INDEX IF NOT EXISTS ai_keyword_estimates_keyword_idx ON ai_keyword_estimates(keyword);
CREATE INDEX IF NOT EXISTS ai_keyword_estimates_collected_at_idx ON ai_keyword_estimates(collected_at);

-- Provider mention metrics (from LLM Mentions and observation analysis).
CREATE TABLE IF NOT EXISTS provider_mention_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    engine TEXT NOT NULL,
    market TEXT NOT NULL,
    language TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    observation_count INTEGER NOT NULL DEFAULT 0,
    brand_mention_count INTEGER NOT NULL DEFAULT 0,
    competitor_mention_count INTEGER NOT NULL DEFAULT 0,
    citation_count INTEGER NOT NULL DEFAULT 0,
    unique_cited_domains INTEGER NOT NULL DEFAULT 0,
    share_of_voice REAL,
    mention_rate REAL,
    citation_rate REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, project_id, engine, market, language, period_start)
);

CREATE INDEX IF NOT EXISTS provider_mention_metrics_org_idx ON provider_mention_metrics(organization_id);
CREATE INDEX IF NOT EXISTS provider_mention_metrics_project_idx ON provider_mention_metrics(project_id);
CREATE INDEX IF NOT EXISTS provider_mention_metrics_period_idx ON provider_mention_metrics(period_start, period_end);

-- Provider capability versions: tracks which DataForSEO endpoints are supported.
CREATE TABLE IF NOT EXISTS provider_capability_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'standard',
    supported BOOLEAN NOT NULL DEFAULT false,
    requires_live BOOLEAN NOT NULL DEFAULT false,
    requires_payment BOOLEAN NOT NULL DEFAULT true,
    cost_model TEXT NOT NULL DEFAULT 'per_task',
    last_verified_at TIMESTAMPTZ,
    notes TEXT,
    UNIQUE(provider_id, endpoint, mode)
);

CREATE INDEX IF NOT EXISTS provider_capability_versions_provider_idx ON provider_capability_versions(provider_id);
