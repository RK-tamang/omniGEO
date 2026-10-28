CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), plan_key TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL, description TEXT, custom_pricing BOOLEAN NOT NULL DEFAULT false,
    is_public BOOLEAN NOT NULL DEFAULT true, active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE plan_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), plan_id UUID NOT NULL REFERENCES plans(id),
    version INTEGER NOT NULL CHECK(version>0), publication_status TEXT NOT NULL DEFAULT 'internal',
    features JSONB NOT NULL DEFAULT '{}'::jsonb, effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(plan_id,version)
);
CREATE TABLE plan_features (
    plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL, feature_value JSONB NOT NULL,
    PRIMARY KEY(plan_version_id,feature_key)
);
CREATE TABLE plan_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), plan_version_id UUID NOT NULL REFERENCES plan_versions(id),
    billing_interval TEXT NOT NULL CHECK(billing_interval IN ('monthly','annual','one_time')),
    amount_minor BIGINT NOT NULL CHECK(amount_minor>=0), currency CHAR(3) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false, trial_days INTEGER NOT NULL DEFAULT 0 CHECK(trial_days BETWEEN 0 AND 90),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(), valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(plan_version_id,billing_interval,currency,valid_from)
);
CREATE INDEX plan_prices_public_idx ON plan_prices(plan_version_id,billing_interval,currency) WHERE enabled AND valid_until IS NULL;

CREATE TABLE billing_accounts (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    billing_email TEXT, legal_name TEXT, country_code CHAR(2), tax_id TEXT,
    default_currency CHAR(3) NOT NULL DEFAULT 'USD', payment_mode TEXT NOT NULL DEFAULT 'manual_invoice' CHECK(payment_mode IN ('manual_invoice','gateway')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_version_id UUID NOT NULL REFERENCES plan_versions(id), plan_price_id UUID REFERENCES plan_prices(id),
    status TEXT NOT NULL CHECK(status IN ('trialing','pending_payment','active','past_due','grace_period','canceled','expired','paused')),
    billing_mode TEXT NOT NULL CHECK(billing_mode IN ('free','manual_invoice','gateway')),
    is_current BOOLEAN NOT NULL DEFAULT true, grandfathered BOOLEAN NOT NULL DEFAULT false,
    custom_price_minor BIGINT CHECK(custom_price_minor IS NULL OR custom_price_minor>=0), custom_currency CHAR(3),
    current_period_start TIMESTAMPTZ, current_period_end TIMESTAMPTZ, trial_ends_at TIMESTAMPTZ,
    grace_period_ends_at TIMESTAMPTZ, cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    last_payment_event_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ, ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK((custom_price_minor IS NULL)=(custom_currency IS NULL))
);
CREATE UNIQUE INDEX subscriptions_current_org_idx ON subscriptions(organization_id) WHERE is_current;
CREATE INDEX subscriptions_renewal_idx ON subscriptions(status,current_period_end) WHERE is_current;
CREATE TABLE subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    event_key TEXT NOT NULL, from_status TEXT, to_status TEXT, source TEXT NOT NULL,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key TEXT, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(subscription_id,idempotency_key)
);
CREATE INDEX subscription_events_org_time_idx ON subscription_events(organization_id,occurred_at DESC);
CREATE TABLE pending_plan_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    target_plan_version_id UUID NOT NULL REFERENCES plan_versions(id), target_plan_price_id UUID NOT NULL REFERENCES plan_prices(id),
    invoice_id UUID, effective_at TIMESTAMPTZ NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('upgrade_prorated','downgrade_immediate')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','canceled')), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pending_plan_changes_one_pending_idx ON pending_plan_changes(subscription_id) WHERE status='pending';

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL UNIQUE, invoice_kind TEXT NOT NULL CHECK(invoice_kind IN ('checkout','renewal','plan_change','credit_topup','enterprise')),
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('draft','open','paid','overdue','void','uncollectible','refunded')),
    currency CHAR(3) NOT NULL, subtotal_minor BIGINT NOT NULL DEFAULT 0 CHECK(subtotal_minor>=0), tax_minor BIGINT NOT NULL DEFAULT 0 CHECK(tax_minor>=0),
    total_minor BIGINT NOT NULL DEFAULT 0 CHECK(total_minor>=0), amount_paid_minor BIGINT NOT NULL DEFAULT 0 CHECK(amount_paid_minor>=0),
    period_start TIMESTAMPTZ, period_end TIMESTAMPTZ, due_at TIMESTAMPTZ NOT NULL,
    pending_plan_version_id UUID REFERENCES plan_versions(id), pending_plan_price_id UUID REFERENCES plan_prices(id),
    last_payment_event_at TIMESTAMPTZ,
    idempotency_key TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), paid_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id,idempotency_key)
);
ALTER TABLE pending_plan_changes ADD CONSTRAINT pending_plan_changes_invoice_fk FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
CREATE INDEX invoices_org_created_idx ON invoices(organization_id,created_at DESC);
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL, quantity BIGINT NOT NULL CHECK(quantity>0), unit_amount_minor BIGINT NOT NULL CHECK(unit_amount_minor>=0),
    amount_minor BIGINT NOT NULL CHECK(amount_minor>=0), metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id), provider_id TEXT NOT NULL,
    provider_reference TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','succeeded','failed','partially_refunded','refunded')),
    amount_minor BIGINT NOT NULL CHECK(amount_minor>=0), currency CHAR(3) NOT NULL,
    verified_at TIMESTAMPTZ, verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider_id,provider_reference)
);
CREATE INDEX payments_invoice_idx ON payments(invoice_id,created_at DESC);
CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), payment_id UUID NOT NULL REFERENCES payments(id),
    amount_minor BIGINT NOT NULL CHECK(amount_minor>0), currency CHAR(3) NOT NULL,
    provider_reference TEXT, reason TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','succeeded','failed')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider_reference)
);
CREATE TABLE payment_providers (
    provider_id TEXT PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT false,
    supports_recurring BOOLEAN NOT NULL DEFAULT false, supports_refunds BOOLEAN NOT NULL DEFAULT false,
    onboarding_country CHAR(2), metadata JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO payment_providers(provider_id,enabled,supports_recurring,metadata)
VALUES('manual_invoice',true,false,'{"requires_operator_verification":true}'::jsonb),('stripe',false,false,'{"disabled_reason":"Merchant country eligibility has not been established."}'::jsonb),('khalti',false,false,'{"disabled_reason":"Merchant KYC and supported billing capabilities have not been established."}'::jsonb)
ON CONFLICT(provider_id) DO NOTHING;
CREATE TABLE payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider_id TEXT NOT NULL REFERENCES payment_providers(provider_id),
    provider_event_id TEXT NOT NULL, event_type TEXT NOT NULL, occurred_at TIMESTAMPTZ,
    processing_status TEXT NOT NULL DEFAULT 'received' CHECK(processing_status IN ('received','processed','ignored','failed')),
    payload JSONB NOT NULL, payload_sha256 TEXT NOT NULL, last_error TEXT, received_at TIMESTAMPTZ NOT NULL DEFAULT now(), processed_at TIMESTAMPTZ,
    UNIQUE(provider_id,provider_event_id)
);
CREATE TABLE credit_accounts (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    balance_units BIGINT NOT NULL DEFAULT 0 CHECK(balance_units>=0), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    amount_units BIGINT NOT NULL CHECK(amount_units<>0), transaction_type TEXT NOT NULL CHECK(transaction_type IN ('included_grant','topup','usage','refund','expiry','adjustment')),
    source_id UUID, expires_at TIMESTAMPTZ, idempotency_key TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(organization_id,idempotency_key)
);
CREATE INDEX credit_transactions_org_time_idx ON credit_transactions(organization_id,created_at DESC);
CREATE TABLE organization_entitlements (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL, value JSONB NOT NULL, source_subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(organization_id,feature_key)
);

INSERT INTO plans(plan_key,display_name,description,custom_pricing) VALUES
('free','Free','Free GEO audit tools.',false),
('starter','Starter','Paid monitoring plan; pricing and usage economics require publication review.',false),
('best_value','Best Value','Expanded monitoring plan; pricing and usage economics require publication review.',false),
('enterprise','Enterprise','Contract-specific features and pricing.',true)
ON CONFLICT(plan_key) DO NOTHING;
INSERT INTO plan_versions(plan_id,version,publication_status,features)
SELECT id,1,CASE plan_key WHEN 'enterprise' THEN 'custom_quote' WHEN 'free' THEN 'public' ELSE 'internal_unvalidated_economics' END,'{}'::jsonb FROM plans
ON CONFLICT(plan_id,version) DO NOTHING;
INSERT INTO plan_features(plan_version_id,feature_key,feature_value)
SELECT pv.id,f.key,f.value FROM plan_versions pv JOIN plans p ON p.id=pv.plan_id
CROSS JOIN LATERAL (VALUES
('audit.basic',CASE WHEN p.plan_key IN ('free','starter','best_value','enterprise') THEN 'true'::jsonb ELSE 'false'::jsonb END),
('audit.schema',CASE WHEN p.plan_key IN ('free','starter','best_value','enterprise') THEN 'true'::jsonb ELSE 'false'::jsonb END),
('audit.pdf_export',CASE WHEN p.plan_key IN ('free','starter','best_value','enterprise') THEN 'true'::jsonb ELSE 'false'::jsonb END),
('projects.max',CASE p.plan_key WHEN 'free' THEN '1'::jsonb WHEN 'starter' THEN '1'::jsonb WHEN 'best_value' THEN '2'::jsonb ELSE jsonb_build_object('enabled',true,'limit',NULL) END),
('prompts.track',CASE p.plan_key WHEN 'free' THEN '0'::jsonb WHEN 'starter' THEN '20'::jsonb WHEN 'best_value' THEN '50'::jsonb ELSE jsonb_build_object('enabled',true,'limit',NULL) END),
('visibility.observe',CASE WHEN p.plan_key='free' THEN 'false'::jsonb ELSE 'true'::jsonb END),
('visibility.monthly_observations','0'::jsonb),
('visibility.monthly_spend_limit_microusd','0'::jsonb),
('reports.monthly_exports',CASE WHEN p.plan_key='free' THEN '10'::jsonb ELSE '0'::jsonb END),
('reports.max_artifact_bytes','25000000'::jsonb),
('credits.included_units','0'::jsonb)
) AS f(key,value)
ON CONFLICT(plan_version_id,feature_key) DO NOTHING;
INSERT INTO plan_prices(plan_version_id,billing_interval,amount_minor,currency,enabled)
SELECT pv.id,'monthly',0,'USD',true FROM plan_versions pv JOIN plans p ON p.id=pv.plan_id WHERE p.plan_key='free'
ON CONFLICT DO NOTHING;

-- New and existing organizations receive a free subscription unless one already exists.
CREATE FUNCTION initialize_billing_for_org() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE free_version UUID; free_price UUID;
BEGIN
  SELECT pv.id INTO free_version FROM plan_versions pv JOIN plans p ON p.id=pv.plan_id WHERE p.plan_key='free' AND pv.version=1;
  SELECT pp.id INTO free_price FROM plan_prices pp WHERE pp.plan_version_id=free_version AND pp.billing_interval='monthly' AND pp.enabled LIMIT 1;
  INSERT INTO billing_accounts(organization_id,default_currency) VALUES(NEW.id,'USD') ON CONFLICT DO NOTHING;
  INSERT INTO credit_accounts(organization_id,balance_units) VALUES(NEW.id,0) ON CONFLICT DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM subscriptions WHERE organization_id=NEW.id AND is_current) THEN
    INSERT INTO subscriptions(organization_id,plan_version_id,plan_price_id,status,billing_mode,current_period_start,current_period_end)
    VALUES(NEW.id,free_version,free_price,'active','free',now(),now()+interval '100 years');
    INSERT INTO organization_entitlements(organization_id,feature_key,value,source_subscription_id)
    SELECT NEW.id,pf.feature_key,pf.feature_value,s.id FROM plan_features pf JOIN subscriptions s ON s.organization_id=NEW.id AND s.is_current WHERE pf.plan_version_id=free_version
    ON CONFLICT(organization_id,feature_key) DO UPDATE SET value=EXCLUDED.value,source_subscription_id=EXCLUDED.source_subscription_id,effective_at=now(),updated_at=now();
    INSERT INTO organization_report_entitlements(organization_id,reports_enabled,monthly_export_limit,max_artifact_bytes)
    VALUES(NEW.id,true,10,25000000) ON CONFLICT(organization_id) DO NOTHING;
    INSERT INTO organization_visibility_entitlements(organization_id,enabled,tracked_prompt_limit,monthly_observation_limit,monthly_spend_limit_microusd)
    VALUES(NEW.id,false,0,0,0) ON CONFLICT(organization_id) DO NOTHING;
    INSERT INTO visibility_credit_accounts(organization_id,balance_microusd) VALUES(NEW.id,0) ON CONFLICT(organization_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
INSERT INTO billing_accounts(organization_id) SELECT id FROM organizations ON CONFLICT DO NOTHING;
INSERT INTO credit_accounts(organization_id) SELECT id FROM organizations ON CONFLICT DO NOTHING;
INSERT INTO subscriptions(organization_id,plan_version_id,plan_price_id,status,billing_mode,current_period_start,current_period_end)
SELECT o.id,pv.id,pp.id,'active','free',now(),now()+interval '100 years'
FROM organizations o
JOIN plans p ON p.plan_key='free'
JOIN plan_versions pv ON pv.plan_id=p.id AND pv.version=1
JOIN plan_prices pp ON pp.plan_version_id=pv.id AND pp.billing_interval='monthly' AND pp.enabled
WHERE NOT EXISTS(SELECT 1 FROM subscriptions s WHERE s.organization_id=o.id AND s.is_current);
INSERT INTO organization_entitlements(organization_id,feature_key,value,source_subscription_id)
SELECT s.organization_id,pf.feature_key,pf.feature_value,s.id FROM subscriptions s JOIN plan_features pf ON pf.plan_version_id=s.plan_version_id WHERE s.is_current
ON CONFLICT(organization_id,feature_key) DO UPDATE SET value=EXCLUDED.value,source_subscription_id=EXCLUDED.source_subscription_id,effective_at=now(),updated_at=now();
INSERT INTO organization_report_entitlements(organization_id,reports_enabled,monthly_export_limit,max_artifact_bytes)
SELECT id,true,10,25000000 FROM organizations ON CONFLICT(organization_id) DO NOTHING;
INSERT INTO organization_visibility_entitlements(organization_id,enabled,tracked_prompt_limit,monthly_observation_limit,monthly_spend_limit_microusd)
SELECT id,false,0,0,0 FROM organizations ON CONFLICT(organization_id) DO NOTHING;
INSERT INTO visibility_credit_accounts(organization_id,balance_microusd) SELECT id,0 FROM organizations ON CONFLICT(organization_id) DO NOTHING;
CREATE TRIGGER organizations_initialize_billing AFTER INSERT ON organizations FOR EACH ROW EXECUTE FUNCTION initialize_billing_for_org();
