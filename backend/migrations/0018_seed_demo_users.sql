-- Seed demo users for development/demo purposes
-- All demo accounts are pre-verified so login works immediately

INSERT INTO users(id, email, display_name, password_hash, email_verified, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'demo@omnigeo.example', 'Demo User', crypt('Demo1234!', gen_salt('bf')), TRUE, now()),
  ('22222222-2222-2222-2222-222222222222', 'admin@omnigeo.example', 'Admin User', crypt('Admin1234!', gen_salt('bf')), TRUE, now()),
  ('77777777-7777-7777-7777-777777777777', 'demo@omnigeo.ai', 'Demo User', crypt('demo1234', gen_salt('bf')), TRUE, now())
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  email_verified = TRUE,
  display_name = EXCLUDED.display_name;

-- Create organizations for demo users (plan column doesn't exist on organizations;
-- billing is handled via plans/subscriptions tables)
INSERT INTO organizations(id, name, created_at)
VALUES
  ('33333333-3333-3333-3333-333333333333', 'Demo Workspace', now()),
  ('44444444-4444-4444-4444-444444444444', 'Admin Workspace', now()),
  ('88888888-8888-8888-8888-888888888888', 'Demo Workspace', now())
ON CONFLICT (id) DO NOTHING;

-- Create memberships linking users to organizations
INSERT INTO memberships(organization_id, user_id, role, created_at)
VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'owner', now()),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'owner', now()),
  ('88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', 'owner', now())
ON CONFLICT DO NOTHING;

-- Create workspaces
INSERT INTO workspaces(id, organization_id, name, created_at)
VALUES
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'Demo Workspace', now()),
  ('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', 'Admin Workspace', now()),
  ('99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888888', 'Demo Workspace', now())
ON CONFLICT (id) DO NOTHING;
