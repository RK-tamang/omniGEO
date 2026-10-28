CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    plan TEXT NOT NULL DEFAULT 'starter',
    role TEXT NOT NULL DEFAULT 'member',
    workspace_name TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','invited','suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT,
    plan TEXT NOT NULL DEFAULT 'starter',
    user_count BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_billing (
    organization_id UUID PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'starter',
    monthly_revenue_microusd BIGINT NOT NULL DEFAULT 0 CHECK(monthly_revenue_microusd>=0),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','past_due','canceled')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed some initial data
INSERT INTO admin_users(email,name,plan,role,workspace_name,status) VALUES
    ('admin@omnigeo.example','Platform Admin','enterprise','owner','OmniGEO Platform','active')
ON CONFLICT (email) DO NOTHING;

INSERT INTO admin_workspaces(name,domain,plan,user_count,status) VALUES
    ('OmniGEO Platform','omnigeo.example','enterprise',12,'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO admin_billing(organization_id,plan,monthly_revenue_microusd,status) VALUES
    ('00000000-0000-0000-0000-000000000000','enterprise',12450000000,'active')
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO admin_settings(key,value) VALUES
    ('session_timeout_minutes', '480'::jsonb),
    ('max_concurrent_scans', '5'::jsonb),
    ('email_notifications_enabled', 'true'::jsonb),
    ('rate_limit_per_minute', '100'::jsonb),
    ('report_retention_days', '90'::jsonb)
ON CONFLICT (key) DO NOTHING;
