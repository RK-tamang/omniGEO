/**
 * Schema migrator for the OmniGEO backend.
 * Creates every table/index declared in src/db/schema.ts using idempotent DDL.
 *
 * Usage: npm run db:migrate   (alias of drizzle-kit push)
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";

const dbPath = process.env.DATABASE_URL || "./data/omnigeo.db";
mkdirSync(dirname(resolve(process.cwd(), dbPath)), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  plan text DEFAULT 'Starter' NOT NULL,
  role text DEFAULT 'member' NOT NULL,
  workspace_id text NOT NULL,
  email_verified integer DEFAULT false,
  created_at integer DEFAULT (unixepoch() * 1000),
  updated_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS workspaces (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  owner_id text NOT NULL REFERENCES users(id),
  plan text DEFAULT 'Starter' NOT NULL,
  billing_interval text DEFAULT 'monthly',
  billing_cycle_start integer,
  trial_ends_at integer,
  settings text,
  created_at integer DEFAULT (unixepoch() * 1000),
  updated_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS domains (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain text NOT NULL,
  is_primary integer DEFAULT false,
  created_at integer DEFAULT (unixepoch() * 1000),
  updated_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS prompts (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  type text DEFAULT 'Question',
  status text DEFAULT 'active',
  engines text,
  target_prompt text,
  sentiment text DEFAULT 'Neutral',
  created_at integer DEFAULT (unixepoch() * 1000),
  updated_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS citations (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prompt_id text NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  engine text NOT NULL,
  domain text NOT NULL,
  url text NOT NULL,
  title text,
  position integer,
  snippet text,
  captured_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS crawls (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url text NOT NULL,
  status text DEFAULT 'pending',
  format text DEFAULT 'markdown',
  result text,
  error text,
  pages_crawled integer DEFAULT 0,
  credits_used integer DEFAULT 0,
  started_at integer,
  completed_at integer,
  created_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS content_items (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  status text DEFAULT 'draft',
  score integer DEFAULT 0,
  target_prompt text,
  target_engines text,
  schema text,
  word_count integer DEFAULT 0,
  citations integer DEFAULT 0,
  assignee_id text REFERENCES users(id),
  published_at integer,
  created_at integer DEFAULT (unixepoch() * 1000),
  updated_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS competitors (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text NOT NULL,
  visibility_score integer DEFAULT 0,
  citations_count integer DEFAULT 0,
  prompts_won integer DEFAULT 0,
  top_citations text,
  last_checked_at integer,
  created_at integer DEFAULT (unixepoch() * 1000),
  updated_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS competitor_prompts (
  id text PRIMARY KEY NOT NULL,
  competitor_id text NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  prompt_id text NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  engine text NOT NULL,
  status text NOT NULL,
  position integer,
  citation_url text,
  captured_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS scans (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain_id text REFERENCES domains(id),
  type text NOT NULL,
  status text DEFAULT 'pending',
  input text,
  result text,
  score integer,
  checks text,
  pages_analyzed integer DEFAULT 0,
  issues_found integer DEFAULT 0,
  credits_used real DEFAULT 0,
  started_at integer,
  completed_at integer,
  error text,
  created_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS billing_usage (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  service text NOT NULL,
  operation text NOT NULL,
  quantity integer DEFAULT 1,
  cost_usd real DEFAULT 0,
  cost_npr real DEFAULT 0,
  metadata text,
  created_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY NOT NULL,
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
  customer_info text,
  metadata text,
  verified_at integer,
  created_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS webhooks (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text,
  secret text NOT NULL,
  active integer DEFAULT true,
  last_triggered_at integer,
  failure_count integer DEFAULT 0,
  created_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS audit_issues (
  id text PRIMARY KEY NOT NULL,
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
  resolved_at integer,
  created_at integer DEFAULT (unixepoch() * 1000),
  updated_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS alerts (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  metadata text,
  read integer DEFAULT false,
  action_url text,
  created_at integer DEFAULT (unixepoch() * 1000),
  read_at integer
);

CREATE TABLE IF NOT EXISTS reports (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  format text DEFAULT 'pdf',
  status text DEFAULT 'pending',
  data text,
  file_url text,
  recipients text,
  scheduled_at integer,
  generated_at integer,
  created_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text,
  updated_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  permissions text,
  last_used_at integer,
  expires_at integer,
  created_at integer DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY NOT NULL,
  workspace_id text REFERENCES workspaces(id),
  user_id text REFERENCES users(id),
  action text NOT NULL,
  resource text,
  resource_id text,
  metadata text,
  ip_address text,
  user_agent text,
  created_at integer DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_prompts_workspace ON prompts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_citations_prompt ON citations(prompt_id);
CREATE INDEX IF NOT EXISTS idx_scans_workspace ON scans(workspace_id);
CREATE INDEX IF NOT EXISTS idx_billing_usage_workspace ON billing_usage(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_crawls_workspace ON crawls(workspace_id);
`;

db.transaction(() => {
  db.exec(DDL);
})();

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  .all()
  .map((r: any) => r.name);

console.log(`Migration complete - ${tables.length} tables ready.`);
console.log(tables.join(", "));
db.close();
