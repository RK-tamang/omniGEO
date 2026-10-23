/**
 * Schema migrator for the OmniGEO backend (Postgres).
 */
import "dotenv/config";
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/omnigeo";

const pool = new Pool({ connectionString });

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'Starter',
  role text NOT NULL DEFAULT 'member',
  workspace_id text NOT NULL,
  email_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner_id text NOT NULL REFERENCES users(id),
  plan text NOT NULL DEFAULT 'Starter',
  billing_interval text DEFAULT 'monthly',
  billing_cycle_start timestamptz,
  trial_ends_at timestamptz,
  settings jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS domains (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain text NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prompts (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  type text DEFAULT 'Question',
  status text DEFAULT 'active',
  engines jsonb,
  target_prompt text,
  sentiment text DEFAULT 'Neutral',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS citations (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prompt_id text NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  engine text NOT NULL,
  domain text NOT NULL,
  url text NOT NULL,
  title text,
  position integer,
  snippet text,
  captured_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crawls (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url text NOT NULL,
  status text DEFAULT 'pending',
  format text DEFAULT 'markdown',
  result jsonb,
  error text,
  pages_crawled integer DEFAULT 0,
  credits_used integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  status text DEFAULT 'draft',
  score integer DEFAULT 0,
  target_prompt text,
  target_engines jsonb,
  schema jsonb,
  word_count integer DEFAULT 0,
  citations integer DEFAULT 0,
  assignee_id text REFERENCES users(id),
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitors (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text NOT NULL,
  visibility_score integer DEFAULT 0,
  citations_count integer DEFAULT 0,
  prompts_won integer DEFAULT 0,
  top_citations jsonb,
  last_checked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitor_prompts (
  id text PRIMARY KEY,
  competitor_id text NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  prompt_id text NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  engine text NOT NULL,
  status text NOT NULL,
  position integer,
  citation_url text,
  captured_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scans (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain_id text REFERENCES domains(id),
  type text NOT NULL,
  status text DEFAULT 'pending',
  input jsonb,
  result jsonb,
  score integer,
  checks jsonb,
  pages_analyzed integer DEFAULT 0,
  issues_found integer DEFAULT 0,
  credits_used real DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_usage (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  service text NOT NULL,
  operation text NOT NULL,
  quantity integer DEFAULT 1,
  cost_usd real DEFAULT 0,
  cost_npr real DEFAULT 0,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  order_id text UNIQUE,
  payment_id text,
  amount integer NOT NULL,
  fee integer DEFAULT 0,
  total_amount integer NOT NULL,
  currency text DEFAULT 'NPR',
  plan text NOT NULL,
  interval text DEFAULT 'monthly',
  status text DEFAULT 'pending',
  customer_info jsonb,
  metadata jsonb,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhooks (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url text NOT NULL,
  events jsonb,
  secret text NOT NULL,
  active boolean DEFAULT true,
  last_triggered_at timestamptz,
  failure_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_issues (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scan_id text REFERENCES scans(id),
  category text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  fix text NOT NULL,
  pages_affected integer DEFAULT 0,
  impact text,
  effort text,
  status text DEFAULT 'open',
  assignee_id text REFERENCES users(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  metadata jsonb,
  read boolean DEFAULT false,
  action_url text,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

CREATE TABLE IF NOT EXISTS reports (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  format text DEFAULT 'pdf',
  status text DEFAULT 'pending',
  data jsonb,
  file_url text,
  recipients jsonb,
  scheduled_at timestamptz,
  generated_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_requests (
  id text PRIMARY KEY,
  intent text DEFAULT 'general' NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  company text NOT NULL,
  website text,
  team_size text,
  budget text,
  message text,
  status text DEFAULT 'new' NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY,
  workspace_id text NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  permissions jsonb,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  workspace_id text REFERENCES workspaces(id),
  user_id text REFERENCES users(id),
  action text NOT NULL,
  resource text,
  resource_id text,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompts_workspace ON prompts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_citations_prompt ON citations(prompt_id);
CREATE INDEX IF NOT EXISTS idx_scans_workspace ON scans(workspace_id);
CREATE INDEX IF NOT EXISTS idx_billing_usage_workspace ON billing_usage(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_crawls_workspace ON crawls(workspace_id);
`;

try {
  await pool.query(DDL);
  const res = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log(`Migration complete - ${res.rowCount} tables ready.`);
  console.log(res.rows.map((r) => r.table_name).join(", "));
} finally {
  await pool.end();
}
