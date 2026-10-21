import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  plan: text("plan", { enum: ["Starter", "Pro Growth", "Enterprise"] }).default("Starter").notNull(),
  role: text("role", { enum: ["owner", "admin", "member", "viewer"] }).default("member").notNull(),
  workspaceId: text("workspace_id").notNull(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  plan: text("plan", { enum: ["Starter", "Pro Growth", "Enterprise"] }).default("Starter").notNull(),
  billingInterval: text("billing_interval", { enum: ["monthly", "yearly"] }).default("monthly"),
  billingCycleStart: integer("billing_cycle_start", { mode: "timestamp" }),
  trialEndsAt: integer("trial_ends_at", { mode: "timestamp" }),
  settings: text("settings", { mode: "json" }).$type<{
    whitelist: string[];
    timezone: string;
    locale: string;
    competitors: string;
    runDay: string;
    digest: string;
    emailDigest: boolean;
    criticalAlerts: boolean;
    productUpdates: boolean;
  }>(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const domains = sqliteTable("domains", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  isPrimary: integer("is_primary", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const prompts = sqliteTable("prompts", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  type: text("type", { enum: ["Category", "Comparison", "Problem", "Brand", "Question", "How-to"] }).default("Question"),
  status: text("status", { enum: ["active", "paused", "archived"] }).default("active"),
  engines: text("engines", { mode: "json" }).$type<Record<string, "cited" | "mentioned" | "missing">>(),
  targetPrompt: text("target_prompt"),
  sentiment: text("sentiment", { enum: ["Positive", "Neutral", "Negative", "Risk"] }).default("Neutral"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const citations = sqliteTable("citations", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  promptId: text("prompt_id").notNull().references(() => prompts.id, { onDelete: "cascade" }),
  engine: text("engine", { enum: ["chatgpt", "perplexity", "gemini", "aio"] }).notNull(),
  domain: text("domain").notNull(),
  url: text("url").notNull(),
  title: text("title"),
  position: integer("position"),
  snippet: text("snippet"),
  capturedAt: integer("captured_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const crawls = sqliteTable("crawls", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  status: text("status", { enum: ["pending", "running", "completed", "failed"] }).default("pending"),
  format: text("format", { enum: ["markdown", "html", "links", "screenshot"] }).default("markdown"),
  result: text("result", { mode: "json" }).$type<{
    title?: string;
    description?: string;
    markdown?: string;
    html?: string;
    links?: Array<{ url: string; text: string }>;
    metadata?: Record<string, any>;
    screenshot?: string;
  }>(),
  error: text("error"),
  pagesCrawled: integer("pages_crawled").default(0),
  creditsUsed: integer("credits_used").default(0),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const contentItems = sqliteTable("content_items", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status", { enum: ["draft", "in_review", "published", "archived"] }).default("draft"),
  score: integer("score").default(0),
  targetPrompt: text("target_prompt"),
  targetEngines: text("target_engines", { mode: "json" }).$type<string[]>(),
  schema: text("schema", { mode: "json" }).$type<Record<string, any>>(),
  wordCount: integer("word_count").default(0),
  citations: integer("citations").default(0),
  assigneeId: text("assignee_id").references(() => users.id),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const competitors = sqliteTable("competitors", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  visibilityScore: integer("visibility_score").default(0),
  citationsCount: integer("citations_count").default(0),
  promptsWon: integer("prompts_won").default(0),
  topCitations: text("top_citations", { mode: "json" }).$type<string[]>(),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const competitorPrompts = sqliteTable("competitor_prompts", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  competitorId: text("competitor_id").notNull().references(() => competitors.id, { onDelete: "cascade" }),
  promptId: text("prompt_id").notNull().references(() => prompts.id, { onDelete: "cascade" }),
  engine: text("engine", { enum: ["chatgpt", "perplexity", "gemini", "aio"] }).notNull(),
  status: text("status", { enum: ["cited", "mentioned", "missing"] }).notNull(),
  position: integer("position"),
  citationUrl: text("citation_url"),
  capturedAt: integer("captured_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const scans = sqliteTable("scans", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  domainId: text("domain_id").references(() => domains.id),
  type: text("type", { enum: ["visibility", "audit", "crawler", "schema", "content"] }).notNull(),
  status: text("status", { enum: ["pending", "running", "completed", "failed"] }).default("pending"),
  input: text("input", { mode: "json" }).$type<Record<string, any>>(),
  result: text("result", { mode: "json" }).$type<Record<string, any>>(),
  score: integer("score"),
  checks: text("checks", { mode: "json" }).$type<Array<{ name: string; status: string; details: string }>>(),
  pagesAnalyzed: integer("pages_analyzed").default(0),
  issuesFound: integer("issues_found").default(0),
  creditsUsed: real("credits_used").default(0),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const billingUsage = sqliteTable("billing_usage", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  service: text("service").notNull(),
  operation: text("operation").notNull(),
  quantity: integer("quantity").default(1),
  costUsd: real("cost_usd").default(0),
  costNpr: real("cost_npr").default(0),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["esewa", "khalti", "stripe"] }).notNull(),
  orderId: text("order_id").notNull().unique(),
  paymentId: text("payment_id"),
  amount: integer("amount").notNull(),
  fee: integer("fee").default(0),
  totalAmount: integer("total_amount").notNull(),
  currency: text("currency", { enum: ["NPR", "USD"] }).default("NPR"),
  plan: text("plan", { enum: ["Starter", "Pro Growth", "Enterprise"] }).notNull(),
  interval: text("interval", { enum: ["monthly", "yearly"] }).default("monthly"),
  status: text("status", { enum: ["pending", "completed", "failed", "refunded"] }).default("pending"),
  customerInfo: text("customer_info", { mode: "json" }).$type<{
    name: string;
    email: string;
    phone: string;
  }>(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>(),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const webhooks = sqliteTable("webhooks", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  events: text("events", { mode: "json" }).$type<string[]>(),
  secret: text("secret").notNull(),
  active: integer("active", { mode: "boolean" }).default(true),
  lastTriggeredAt: integer("last_triggered_at", { mode: "timestamp" }),
  failureCount: integer("failure_count").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const auditIssues = sqliteTable("audit_issues", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  scanId: text("scan_id").references(() => scans.id),
  category: text("category").notNull(),
  severity: text("severity", { enum: ["Critical", "Warning", "Notice", "Good"] }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  fix: text("fix").notNull(),
  pagesAffected: integer("pages_affected").default(0),
  impact: text("impact"),
  effort: text("effort"),
  status: text("status", { enum: ["open", "in_progress", "resolved", "ignored"] }).default("open"),
  assigneeId: text("assignee_id").references(() => users.id),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["citation_lost", "new_competitor", "visibility_drop", "site_change", "citation_gained", "schema_error"] }).notNull(),
  severity: text("severity", { enum: ["Critical", "Warning", "Notice"] }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>(),
  read: integer("read", { mode: "boolean" }).default(false),
  actionUrl: text("action_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  readAt: integer("read_at", { mode: "timestamp" }),
});

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", { enum: ["weekly", "monthly", "competitor_movement", "citation_health", "custom"] }).notNull(),
  format: text("format", { enum: ["pdf", "csv", "json", "white_label_pdf"] }).default("pdf"),
  status: text("status", { enum: ["pending", "generating", "completed", "failed"] }).default("pending"),
  data: text("data", { mode: "json" }).$type<Record<string, any>>(),
  fileUrl: text("file_url"),
  recipients: text("recipients", { mode: "json" }).$type<string[]>(),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
  generatedAt: integer("generated_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }).unique(),
  key: text("key").notNull(),
  value: text("value", { mode: "json" }).$type<any>(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  permissions: text("permissions", { mode: "json" }).$type<string[]>(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  workspaceId: text("workspace_id").references(() => workspaces.id),
  userId: text("user_id").references(() => users.id),
  action: text("action").notNull(),
  resource: text("resource"),
  resourceId: text("resource_id"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;
export type Citation = typeof citations.$inferSelect;
export type NewCitation = typeof citations.$inferInsert;
export type Crawl = typeof crawls.$inferSelect;
export type NewCrawl = typeof crawls.$inferInsert;
export type ContentItem = typeof contentItems.$inferSelect;
export type NewContentItem = typeof contentItems.$inferInsert;
export type Competitor = typeof competitors.$inferSelect;
export type NewCompetitor = typeof competitors.$inferInsert;
export type Scan = typeof scans.$inferSelect;
export type NewScan = typeof scans.$inferInsert;
export type BillingUsage = typeof billingUsage.$inferSelect;
export type NewBillingUsage = typeof billingUsage.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type AuditIssue = typeof auditIssues.$inferSelect;
export type NewAuditIssue = typeof auditIssues.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;