-- Shared first-party and WorkOS AuthKit identity records.
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN workos_user_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
UPDATE users SET email_verified=TRUE;
CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));
ALTER TABLE sessions ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'local'
    CHECK (auth_provider IN ('local','workos'));
ALTER TABLE sessions ADD COLUMN provider_session_id TEXT;
ALTER TABLE sessions ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX sessions_user_active_idx ON sessions(user_id,expires_at DESC) WHERE revoked_at IS NULL;

CREATE TABLE auth_flow_states (
    state_hash TEXT PRIMARY KEY,
    flow TEXT NOT NULL CHECK (flow IN ('workos_login','email_verification','password_reset')),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_flow_states_expiry_idx ON auth_flow_states(expires_at);

CREATE TABLE login_attempts (
    email_hash TEXT PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK(failed_attempts >= 0),
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_until TIMESTAMPTZ
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    action_url TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON notifications(user_id,created_at DESC) WHERE read_at IS NULL;

CREATE TABLE email_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient TEXT NOT NULL,
    template_key TEXT NOT NULL,
    subject TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','failed')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_by TEXT,
    lease_expires_at TIMESTAMPTZ,
    provider_message_id TEXT,
    last_error TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);
CREATE INDEX email_outbox_claim_idx ON email_outbox(status,available_at) WHERE status='queued';

CREATE TABLE organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role membership_role NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organization_invitations_email_unique ON organization_invitations(organization_id,lower(email)) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX organization_invitations_pending_idx ON organization_invitations(organization_id,expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;
