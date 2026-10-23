import "dotenv/config";
import Fastify from "fastify";
import type { preHandlerHookHandler } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { db } from "./db/index.js";
import {
  users, workspaces, domains, scans, billingUsage, payments, webhooks, apiKeys,
  settings, crawls, contentItems, contactRequests, prompts, citations, auditIssues,
  competitors, competitorPrompts, alerts, reports
} from "./db/schema.js";
import { eq, and, desc, gte, lte, inArray, sql } from "drizzle-orm";
import { verifyPassword, generateToken, generateApiKey, verifyWebhookSignature } from "./utils/auth.js";
import { hashPassword } from "./utils/auth.js";
import { runScan } from "./engine/runner.js";
import {
  DASHBOARD_BLOCKS,
  DASHBOARD_BLOCK_GROUPS,
  DASHBOARD_PRESETS,
  normalizeDashboardLayout,
} from "./db/dashboard-layout.js";
import { generateContent, modifyContent, usdToNpr } from "./services/llm.js";
import { scrapeUrl, scrapeBulk, fetchTextResource } from "./services/crawler.js";
import { getLLMMentions, getKeywordIdeas, getMapsRankings } from "./services/dataforseo.js";
import { parseBotAccess } from "./services/robots.js";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";

/**
 * Whether the session cookie carries the Secure flag.
 *
 * A browser only stores a Secure cookie over HTTPS, so tying the flag to
 * NODE_ENV quietly breaks a plain-HTTP deployment (the Docker stack on
 * http://localhost). Follow the public URL instead, with an explicit
 * override for deployments behind a TLS terminator.
 */
function cookieSecure(): boolean {
  const explicit = process.env.COOKIE_SECURE;
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return (process.env.FRONTEND_URL ?? "").startsWith("https://");
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
    optionalAuth: preHandlerHookHandler;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      userId: string;
      workspaceId: string;
      email: string;
      name?: string;
      plan: string;
    };
    user: {
      userId: string;
      workspaceId: string;
      email: string;
      name?: string;
      plan: string;
    };
  }
}

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport: process.env.NODE_ENV !== "production" ? {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss Z", ignore: "pid,hostname" }
    } : undefined
  },
  // Behind a TLS terminator the real client address arrives in
  // X-Forwarded-For. Opt in with TRUST_PROXY=true; leave it off when the API is
  // reachable directly, otherwise clients could spoof their address.
  trustProxy: process.env.TRUST_PROXY === "true"
});

await app.register(cors, {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
});

await app.register(cookie, {
  secret: process.env.COOKIE_SECRET || "dev-secret",
  parseOptions: { httpOnly: true, secure: cookieSecure(), sameSite: "lax" }
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET || "dev-secret",
  cookie: { cookieName: "auth_token", signed: false },
  sign: { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
});

// Requests from the frontend arrive over the compose network, so they all
// share one address. The default is deliberately generous for that case;
// lower it with RATE_LIMIT_MAX when the API is exposed directly.
await app.register(rateLimit, {
  max: Number(process.env.RATE_LIMIT_MAX ?? 1000),
  timeWindow: process.env.RATE_LIMIT_WINDOW ?? "1 minute",
  keyGenerator: (req) => req.ip,
  // Liveness probes must never be throttled.
  allowList: (req) => req.url === "/health",
});

await app.register(websocket);

app.decorate("authenticate", async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
});

app.decorate("optionalAuth", async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch {
    // Optional auth - continue without user
  }
});

const authSchema = {
  login: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    rememberMe: z.boolean().optional()
  }),
  register: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2).max(100),
    /** The brand the workspace tracks. */
    brandName: z.string().min(2).max(100),
    /** What the business does — drives the prompt and content templates. */
    category: z.string().min(2).max(60),
    /** The business website. Becomes the workspace's tracked domain. */
    website: z.string().min(3).max(255),
    /** The market the workspace reports on, e.g. "en-IN". */
    market: z.string().max(20).optional(),
    plan: z.enum(["Starter", "Pro Growth", "Enterprise"]).default("Starter")
  }),
  changePassword: z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8)
  }),
  forgotPassword: z.object({ email: z.string().email() }),
  resetPassword: z.object({
    token: z.string(),
    password: z.string().min(8)
  }),
  guest: z.object({
    plan: z.enum(["Starter", "Pro Growth", "Enterprise"]).default("Pro Growth")
  }).default({})
};

const scanDomain = z
  .string()
  .min(1)
  .transform((value) => {
    const trimmed = value.trim();
    // Accept bare hostnames ("example.com") as well as full URLs — the UI and
    // workspace whitelist store bare domains, so normalise before validating.
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  })
  .pipe(z.string().url());

const scanSchema = {
  visibility: z.object({
    domain: scanDomain,
    engines: z.array(z.enum(["chatgpt", "perplexity", "gemini", "aio"])).optional(),
    prompts: z.array(z.string().min(3)).max(12).optional()
  }),
  audit: z.object({
    domain: scanDomain,
    depth: z.enum(["quick", "full", "deep"]).default("full")
  }),
  crawler: z.object({
    url: z.string().url().optional(),
    urls: z.array(z.string().url()).max(25).optional(),
    provider: z.enum(["firecrawl", "jina", "native"]).optional(),
    format: z.enum(["markdown", "html", "links", "screenshot"]).default("markdown"),
    onlyMainContent: z.boolean().default(true)
  }).refine((d) => d.url || (d.urls && d.urls.length > 0), {
    message: "Provide either url or urls"
  })
};

/** Fire-and-forget scan execution; failures are recorded on the scan row. */
function startScanInBackground(scanId: string): void {
  runScan(scanId).catch((err) => {
    app.log.error({ err, scanId }, "Scan execution failed");
  });
}

const contentSchema = {
  generate: z.object({
    prompt: z.string().min(10),
    systemPrompt: z.string().optional(),
    model: z.enum(["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"]).default("gpt-4o-mini"),
    maxTokens: z.number().min(100).max(8000).default(4000)
  }),
  modify: z.object({
    content: z.string().min(50),
    instruction: z.string().min(10),
    format: z.enum(["markdown", "html", "json", "table"]).default("markdown"),
    model: z.enum(["claude-3-5-haiku", "claude-3-5-sonnet"]).default("claude-3-5-haiku")
  })
};

const billingSchema = {
  initiate: z.object({
    provider: z.enum(["esewa", "khalti"]),
    plan: z.enum(["Starter", "Pro Growth", "Enterprise"]),
    interval: z.enum(["monthly", "yearly"]).default("monthly"),
    returnUrl: z.string().url(),
    cancelUrl: z.string().url()
  }),
  verify: z.object({
    provider: z.enum(["esewa", "khalti"]),
    paymentId: z.string(),
    orderId: z.string()
  })
};

app.post("/api/auth/login", async (request, reply) => {
  const data = authSchema.login.parse(request.body);
  const user = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

  if (!user[0] || !(await verifyPassword(data.password, user[0].passwordHash))) {
    return reply.code(401).send({ error: "Invalid credentials" });
  }

  const workspace = await db.select().from(workspaces).where(eq(workspaces.id, user[0].workspaceId)).limit(1);
  const token = generateToken({ userId: user[0].id, workspaceId: user[0].workspaceId, email: user[0].email, name: user[0].name, plan: workspace[0]?.plan || "Starter" });

  reply.setCookie("auth_token", token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });

  return { user: { id: user[0].id, email: user[0].email, name: user[0].name, plan: workspace[0]?.plan, workspaceId: user[0].workspaceId } };
});

app.post("/api/auth/register", async (request, reply) => {
  const data = authSchema.register.parse(request.body);
  const existing = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

  if (existing.length > 0) {
    return reply.code(409).send({ error: "Email already registered" });
  }

  const userId = createId();
  const workspaceId = createId();
  const passwordHash = await hashPassword(data.password);

  // The website the business gave us is the domain the workspace tracks.
  const domain = data.website
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];

  const workspaceSettings = {
    whitelist: [domain],
    brandName: data.brandName,
    category: data.category,
    timezone: "Asia/Kolkata",
    locale: data.market || "en-IN",
    competitors: "",
    runDay: "Monday",
    digest: "Weekly",
    emailDigest: true,
    criticalAlerts: true,
    productUpdates: false,
  };

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      email: data.email,
      passwordHash,
      name: data.name,
      plan: data.plan,
      role: "owner",
      workspaceId,
      emailVerified: false
    });

    await tx.insert(workspaces).values({
      id: workspaceId,
      name: data.brandName,
      ownerId: userId,
      plan: data.plan,
      billingInterval: "monthly",
      billingCycleStart: new Date(),
      settings: workspaceSettings
    });

    await tx.insert(domains).values({
      id: createId(),
      workspaceId,
      domain,
      isPrimary: true
    });

    await tx.insert(settings).values({
      id: createId(),
      workspaceId,
      key: "workspace_settings",
      value: workspaceSettings
    });
  });

  const token = generateToken({ userId, workspaceId, email: data.email, name: data.name, plan: data.plan });

  reply.setCookie("auth_token", token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });

  return { user: { id: userId, email: data.email, name: data.name, plan: data.plan, workspaceId } };
});

app.post("/api/auth/logout", async (request, reply) => {
  reply.clearCookie("auth_token", { path: "/" });
  return { success: true };
});

/**
 * Provision (or resume) a login-free guest session.
 *
 * Used by the dashboard so visitors can explore the real engine without
 * creating an account. When a valid `auth_token` is already present the
 * existing identity is returned unchanged (idempotent); otherwise a fresh
 * guest user + workspace are created with starter demo domains.
 */
app.post("/api/auth/guest", async (request, reply) => {
  // Resume an existing session rather than minting a new guest every load.
  const existingToken = (request.cookies as Record<string, string | undefined>)?.auth_token;
  if (existingToken) {
    try {
      const decoded = app.jwt.verify<{ userId: string; workspaceId: string; email: string; name: string; plan: string }>(existingToken);
      const existingUser = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
      if (existingUser[0]) {
        return {
          user: {
            id: existingUser[0].id,
            email: existingUser[0].email,
            name: existingUser[0].name,
            plan: decoded.plan,
            workspaceId: existingUser[0].workspaceId,
            workspaceName: (await db.select().from(workspaces).where(eq(workspaces.id, existingUser[0].workspaceId)).limit(1))[0]?.name,
            resumed: true
          }
        };
      }
    } catch {
      // Fall through and mint a new guest session.
    }
  }

  const data = authSchema.guest.parse(request.body ?? {});
  const userId = createId();
  const workspaceId = createId();
  const email = `guest_${userId}@guest.omnigeo.local`;
  const passwordHash = await hashPassword(createId() + createId());
  const plan = data.plan;

  const demoDomains: string[] = [];

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      email,
      passwordHash,
      name: "Guest Explorer",
      plan,
      role: "owner",
      workspaceId,
      emailVerified: false
    });

    await tx.insert(workspaces).values({
      id: workspaceId,
      name: "Guest Workspace",
      ownerId: userId,
      plan,
      billingInterval: "monthly",
      billingCycleStart: new Date(),
      settings: {
        whitelist: demoDomains,
        timezone: "Asia/Kolkata",
        locale: "en-IN",
        competitors: "",
        runDay: "Monday",
        digest: "Weekly",
        emailDigest: true,
        criticalAlerts: true,
        productUpdates: false
      }
    });
  });

  const token = generateToken({ userId, workspaceId, email, name: "Guest Explorer", plan });

  reply.setCookie("auth_token", token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });

  return { user: { id: userId, email, name: "Guest Explorer", plan, workspaceId, workspaceName: "Guest Workspace", guest: true } };
});

app.get("/api/auth/me", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { userId: string; workspaceId: string; email: string; plan: string };
  const workspace = await db.select().from(workspaces).where(eq(workspaces.id, user.workspaceId)).limit(1);
  const userData = await db.select().from(users).where(eq(users.id, user.userId)).limit(1);

  return {
    user: {
      id: user.userId,
      email: user.email,
      name: userData[0]?.name,
      plan: user.plan,
      workspaceId: user.workspaceId,
      workspaceName: workspace[0]?.name
    }
  };
});

app.post("/api/auth/forgot-password", async (request, reply) => {
  const data = authSchema.forgotPassword.parse(request.body);
  const user = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

  if (!user[0]) {
    return reply.code(404).send({ error: "User not found" });
  }

  const resetToken = createId();
  await db.update(users).set({ passwordHash: resetToken }).where(eq(users.id, user[0].id));

  return { message: "Password reset email sent (check logs in dev)" };
});

app.post("/api/auth/reset-password", async (request, reply) => {
  const data = authSchema.resetPassword.parse(request.body);
  const user = await db.select().from(users).where(eq(users.passwordHash, data.token)).limit(1);

  if (!user[0]) {
    return reply.code(400).send({ error: "Invalid or expired reset token" });
  }

  const passwordHash = await hashPassword(data.password);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user[0].id));

  return { success: true };
});

app.post("/api/auth/change-password", { preHandler: [app.authenticate] }, async (request, reply) => {
  const data = authSchema.changePassword.parse(request.body);
  const user = request.user as { userId: string };

  const dbUser = await db.select().from(users).where(eq(users.id, user.userId)).limit(1);
  if (!dbUser[0] || !(await verifyPassword(data.currentPassword, dbUser[0].passwordHash))) {
    return reply.code(400).send({ error: "Current password is incorrect" });
  }

  const passwordHash = await hashPassword(data.newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.userId));

  return { success: true };
});

app.get("/api/workspace", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const workspace = await db.select().from(workspaces).where(eq(workspaces.id, user.workspaceId)).limit(1);
  const domainsList = await db.select().from(domains).where(eq(domains.workspaceId, user.workspaceId));

  return { workspace: workspace[0], domains: domainsList };
});

/**
 * Everything the dashboard renders, straight from the workspace's own rows.
 *
 * The frontend has a static demo dataset it falls back to when no backend is
 * running; this endpoint is the live equivalent so the dashboard reflects what
 * the workspace has actually tracked, generated and crawled.
 */
app.get("/api/workspace/data", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const workspaceId = user.workspaceId;

  const [workspaceRows, domainRows, promptRows, citationRows, contentRows, scanRows, crawlRows, auditRows, competitorRows, alertRows, reportRows, webhookRows] =
    await Promise.all([
      db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
      db.select().from(domains).where(eq(domains.workspaceId, workspaceId)),
      db.select().from(prompts).where(eq(prompts.workspaceId, workspaceId)),
      db.select().from(citations).where(eq(citations.workspaceId, workspaceId)),
      db.select().from(contentItems).where(eq(contentItems.workspaceId, workspaceId)),
      db.select().from(scans).where(eq(scans.workspaceId, workspaceId)),
      db.select().from(crawls).where(eq(crawls.workspaceId, workspaceId)),
      db.select().from(auditIssues).where(eq(auditIssues.workspaceId, workspaceId)),
      db.select().from(competitors).where(eq(competitors.workspaceId, workspaceId)),
      db.select().from(alerts).where(eq(alerts.workspaceId, workspaceId)),
      db.select().from(reports).where(eq(reports.workspaceId, workspaceId)),
      db.select().from(webhooks).where(eq(webhooks.workspaceId, workspaceId)),
    ]);

  // competitor_prompts has no workspace column of its own — it hangs off the
  // competitors, so scope it by the competitors this workspace owns.
  const competitorPromptRows = competitorRows.length
    ? await db
        .select()
        .from(competitorPrompts)
        .where(
          inArray(
            competitorPrompts.competitorId,
            competitorRows.map((c) => c.id),
          ),
        )
    : [];

  return {
    workspace: workspaceRows[0] ?? null,
    domains: domainRows,
    prompts: promptRows,
    citations: citationRows,
    contentItems: contentRows,
    scans: scanRows,
    crawls: crawlRows,
    auditIssues: auditRows,
    competitors: competitorRows,
    competitorPrompts: competitorPromptRows,
    alerts: alertRows,
    reports: reportRows,
    // The webhook secret never leaves the backend.
    webhooks: webhookRows.map(({ secret: _secret, ...rest }) => rest),
  };
});

app.patch("/api/workspace", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const data = z.object({
    name: z.string().min(2).max(100).optional(),
    settings: z.object({
      whitelist: z.array(z.string()).optional(),
      timezone: z.string().optional(),
      locale: z.string().optional(),
      competitors: z.string().optional(),
      runDay: z.string().optional(),
      digest: z.string().optional(),
      emailDigest: z.boolean().optional(),
      criticalAlerts: z.boolean().optional(),
      productUpdates: z.boolean().optional(),
    }).optional()
  }).parse(request.body);

  const existing = await db
    .select({ settings: workspaces.settings })
    .from(workspaces)
    .where(eq(workspaces.id, user.workspaceId))
    .limit(1);

  const mergedSettings = data.settings
    ? { ...(existing[0]?.settings ?? {}), ...data.settings }
    : undefined;

  const updated = await db.update(workspaces).set({
    ...(data.name ? { name: data.name } : {}),
    ...(mergedSettings ? { settings: mergedSettings as any } : {})
  }).where(eq(workspaces.id, user.workspaceId)).returning();
  return { workspace: updated[0] };
});

app.post("/api/domains", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const data = z.object({ domain: z.string().min(3).max(255), isPrimary: z.boolean().default(false) }).parse(request.body);

  const normalizedDomain = data.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

  if (data.isPrimary) {
    await db.update(domains).set({ isPrimary: false }).where(eq(domains.workspaceId, user.workspaceId));
  }

  const domain = await db.insert(domains).values({
    id: createId(),
    workspaceId: user.workspaceId,
    domain: normalizedDomain,
    isPrimary: data.isPrimary
  }).returning();

  return { domain: domain[0] };
});

app.delete("/api/domains/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const { id } = z.object({ id: z.string() }).parse(request.params);

  await db.delete(domains).where(and(eq(domains.id, id), eq(domains.workspaceId, user.workspaceId)));
  return { success: true };
});

app.post("/api/scans/visibility", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string; userId: string };
  const data = scanSchema.visibility.parse(request.body);

  const scanId = createId();
  await db.insert(scans).values({
    id: scanId,
    workspaceId: user.workspaceId,
    type: "visibility",
    status: "pending",
    input: {
      domain: data.domain,
      engines: data.engines || ["chatgpt", "perplexity", "gemini", "aio"],
      ...(data.prompts ? { prompts: data.prompts } : {})
    }
  });

  startScanInBackground(scanId);
  return { scanId, status: "pending", message: "Visibility scan queued" };
});

app.post("/api/scans/audit", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string; userId: string };
  const data = scanSchema.audit.parse(request.body);

  const scanId = createId();
  await db.insert(scans).values({
    id: scanId,
    workspaceId: user.workspaceId,
    type: "audit",
    status: "pending",
    input: { domain: data.domain, depth: data.depth }
  });

  startScanInBackground(scanId);
  return { scanId, status: "pending", message: "Audit scan queued" };
});

app.post("/api/scans/crawler", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string; userId: string };
  const data = scanSchema.crawler.parse(request.body);

  const scanId = createId();
  await db.insert(scans).values({
    id: scanId,
    workspaceId: user.workspaceId,
    type: "crawler",
    status: "pending",
    input: {
      url: data.url,
      urls: data.urls,
      provider: data.provider,
      format: data.format,
      onlyMainContent: data.onlyMainContent
    }
  });

  startScanInBackground(scanId);
  return { scanId, status: "pending", message: "Crawl job queued" };
});

app.get("/api/scans", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const { type, status, limit = "20", offset = "0" } = request.query as Record<string, string>;

  const conditions = [eq(scans.workspaceId, user.workspaceId)];
  if (type) conditions.push(eq(scans.type, type as any));
  if (status) conditions.push(eq(scans.status, status as any));

  const scansList = await db.select().from(scans)
    .where(and(...conditions))
    .orderBy(desc(scans.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  return { scans: scansList };
});

app.get("/api/scans/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const { id } = z.object({ id: z.string() }).parse(request.params);

  const scan = await db.select().from(scans)
    .where(and(eq(scans.id, id), eq(scans.workspaceId, user.workspaceId)))
    .limit(1);

  if (!scan[0]) return reply.code(404).send({ error: "Scan not found" });
  return { scan: scan[0] };
});

// ---------------------------------------------------------------------------
// Crawler endpoints (single + bulk), persisted to `crawls`
// ---------------------------------------------------------------------------

const crawlerSchema = {
  scrape: z.object({
    url: z.string().url(),
    provider: z.enum(["firecrawl", "jina", "native"]).optional(),
    onlyMainContent: z.boolean().default(true)
  }),
  bulk: z.object({
    urls: z.array(z.string().url()).min(1).max(25),
    provider: z.enum(["firecrawl", "jina", "native"]).optional(),
    onlyMainContent: z.boolean().default(true)
  })
};

/**
 * Live AI crawler access.
 *
 * Fetches the workspace domain's real robots.txt and reports, per answer-engine
 * bot, whether that bot can reach the site. Nothing here is estimated — the
 * answer comes from the file the site is serving right now.
 */
app.get("/api/crawler/robots", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const requested = (request.query as Record<string, string | undefined>)?.domain;

  let domain = requested?.trim();
  if (!domain) {
    const domainRows = await db
      .select()
      .from(domains)
      .where(eq(domains.workspaceId, user.workspaceId));
    domain = (domainRows.find((d) => d.isPrimary) ?? domainRows[0])?.domain;
  }

  if (!domain) {
    return reply.code(400).send({ error: "No domain is set for this workspace." });
  }

  const origin = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain.replace(/\/$/, "")}`;
  const robots = await fetchTextResource(`${origin}/robots.txt`);

  if (!robots.ok) {
    // No robots.txt was served. We did not read a policy, so we do not report
    // one — the UI says the file is missing rather than claiming every bot is
    // allowed.
    return reply.code(200).send({
      domain,
      found: false,
      status: robots.status,
      body: "",
      bots: [],
      fetchedAt: new Date().toISOString(),
    });
  }

  return reply.code(200).send({
    domain,
    found: true,
    status: robots.status,
    body: robots.body,
    bots: parseBotAccess(robots.body),
    fetchedAt: new Date().toISOString(),
  });
});

app.post("/api/crawler/scrape", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const data = crawlerSchema.scrape.parse(request.body);

  const result = await scrapeUrl(data.url, { provider: data.provider, onlyMainContent: data.onlyMainContent });

  const [row] = await db.insert(crawls).values({
    workspaceId: user.workspaceId,
    url: data.url,
    status: result.success ? "completed" : "failed",
    format: "markdown",
    result: result.data
      ? {
          title: result.data.title,
          description: result.data.description,
          markdown: result.data.markdown.slice(0, 300_000),
          links: result.data.links.slice(0, 200),
          metadata: result.data.metadata
        }
      : undefined,
    error: result.error,
    pagesCrawled: result.success ? 1 : 0,
    creditsUsed: result.creditsUsed,
    startedAt: new Date(),
    completedAt: new Date()
  }).returning();

  if (result.creditsUsed > 0) {
    await db.insert(billingUsage).values({
      workspaceId: user.workspaceId,
      service: result.provider,
      operation: "scrape",
      quantity: 1,
      costUsd: result.creditsUsed * 0.001,
      costNpr: usdToNpr(result.creditsUsed * 0.001),
      metadata: { url: data.url }
    });
  }

  return {
    success: result.success,
    crawlId: row?.id,
    data: result.data,
    error: result.error,
    creditsUsed: result.creditsUsed,
    provider: result.provider,
    simulated: result.simulated
  };
});

app.post("/api/crawler/bulk", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const data = crawlerSchema.bulk.parse(request.body);

  const results = await scrapeBulk(data.urls, { provider: data.provider, onlyMainContent: data.onlyMainContent });
  let creditsUsed = 0;
  let succeeded = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    creditsUsed += r.creditsUsed;
    if (r.success) succeeded++;

    await db.insert(crawls).values({
      workspaceId: user.workspaceId,
      url: data.urls[i],
      status: r.success ? "completed" : "failed",
      format: "markdown",
      result: r.data
        ? {
            title: r.data.title,
            description: r.data.description,
            markdown: r.data.markdown.slice(0, 300_000),
            links: r.data.links.slice(0, 200),
            metadata: r.data.metadata
          }
        : undefined,
      error: r.error,
      pagesCrawled: r.success ? 1 : 0,
      creditsUsed: r.creditsUsed,
      startedAt: new Date(),
      completedAt: new Date()
    });

    if (r.creditsUsed > 0) {
      await db.insert(billingUsage).values({
        workspaceId: user.workspaceId,
        service: r.provider,
        operation: "scrape",
        quantity: 1,
        costUsd: r.creditsUsed * 0.001,
        costNpr: usdToNpr(r.creditsUsed * 0.001),
        metadata: { url: data.urls[i] }
      });
    }
  }

  return {
    success: succeeded > 0,
    pages: results.length,
    succeeded,
    failed: results.length - succeeded,
    creditsUsed,
    data: results
  };
});

// ---------------------------------------------------------------------------
// DataForSEO endpoints (LLM mentions, keyword ideas, maps rankings)
// ---------------------------------------------------------------------------

const dfsSchema = {
  llmMentions: z.object({
    prompt: z.string().min(3),
    model: z.string().default("chatgpt"),
    location_code: z.number().int().optional(),
    language_code: z.string().optional()
  }),
  keywordIdeas: z.object({
    keywords: z.array(z.string().min(1)).min(1).max(10),
    location_code: z.number().int().optional(),
    language_code: z.string().optional(),
    include_serp_info: z.boolean().default(false)
  }),
  maps: z.object({
    keyword: z.string().min(2),
    location_code: z.number().int().optional(),
    language_code: z.string().optional(),
    depth: z.number().int().min(1).max(20).default(10),
    grid_size: z.enum(["5x5", "7x7"]).default("5x5")
  })
};

app.post("/api/dataforseo/llm-mentions", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const data = dfsSchema.llmMentions.parse(request.body);

  const result = await getLLMMentions(data);

  await db.insert(billingUsage).values({
    workspaceId: user.workspaceId,
    service: "dataforseo",
    operation: "llm_api",
    quantity: result.creditsUsed,
    costUsd: result.costUsd,
    costNpr: usdToNpr(result.costUsd),
    metadata: { prompt: data.prompt.slice(0, 100), model: data.model, simulated: result.simulated }
  });

  return {
    success: result.success,
    data: { answer: result.answer, citations: result.citations, model: result.model },
    creditsUsed: result.creditsUsed,
    simulated: result.simulated,
    error: result.error
  };
});

app.post("/api/dataforseo/keyword-ideas", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const data = dfsSchema.keywordIdeas.parse(request.body);

  const result = await getKeywordIdeas(data);

  await db.insert(billingUsage).values({
    workspaceId: user.workspaceId,
    service: "dataforseo",
    operation: "keyword_ideas",
    quantity: result.creditsUsed,
    costUsd: result.costUsd,
    costNpr: usdToNpr(result.costUsd),
    metadata: { keywords: data.keywords.slice(0, 5), simulated: result.simulated }
  });

  return {
    success: result.success,
    data: { keywords: result.keywords },
    creditsUsed: result.creditsUsed,
    simulated: result.simulated,
    error: result.error
  };
});

app.post("/api/dataforseo/maps", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const data = dfsSchema.maps.parse(request.body);

  const result = await getMapsRankings(data);

  await db.insert(billingUsage).values({
    workspaceId: user.workspaceId,
    service: "dataforseo",
    operation: "maps_api",
    quantity: result.creditsUsed,
    costUsd: result.costUsd,
    costNpr: usdToNpr(result.costUsd),
    metadata: { keyword: data.keyword.slice(0, 100), grid: data.grid_size, simulated: result.simulated }
  });

  return {
    success: result.success,
    data: { items: result.items, gridPoints: result.gridPoints },
    creditsUsed: result.creditsUsed,
    simulated: result.simulated,
    error: result.error
  };
});

app.post("/api/content/generate", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string; userId: string };
  const data = contentSchema.generate.parse(request.body);

  const result = await generateContent({
    prompt: data.prompt,
    systemPrompt: data.systemPrompt,
    model: data.model,
    maxTokens: data.maxTokens
  });

  const wordCount = result.content.split(/\s+/).filter(Boolean).length;
  const [item] = await db.insert(contentItems).values({
    workspaceId: user.workspaceId,
    title: data.prompt.trim().slice(0, 80),
    content: result.content,
    status: "draft",
    targetPrompt: data.prompt.slice(0, 500),
    wordCount
  }).returning();

  await db.insert(billingUsage).values({
    workspaceId: user.workspaceId,
    service: "openai",
    operation: "generate",
    quantity: 1,
    costUsd: result.usage.estimatedCost,
    costNpr: usdToNpr(result.usage.estimatedCost),
    metadata: { model: result.model, simulated: result.simulated, totalTokens: result.usage.totalTokens }
  });

  return {
    success: true,
    itemId: item?.id,
    content: result.content,
    usage: result.usage,
    model: result.model,
    simulated: result.simulated,
    ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {})
  };
});

app.post("/api/content/modify", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string; userId: string };
  const data = contentSchema.modify.parse(request.body);

  const result = await modifyContent({
    content: data.content,
    instruction: data.instruction,
    format: data.format,
    model: data.model === "claude-3-5-sonnet" ? "claude-3-5-sonnet" : "claude-3-5-haiku"
  });

  await db.insert(billingUsage).values({
    workspaceId: user.workspaceId,
    service: "anthropic",
    operation: "modify",
    quantity: 1,
    costUsd: result.usage.estimatedCost,
    costNpr: usdToNpr(result.usage.estimatedCost),
    metadata: { model: result.model, format: data.format, simulated: result.simulated, totalTokens: result.usage.totalTokens }
  });

  return {
    success: true,
    content: result.content,
    usage: result.usage,
    model: result.model,
    simulated: result.simulated,
    ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {})
  };
});

app.post("/api/schema/inject", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string; plan: string };
  if (user.plan !== "Enterprise") {
    return reply.code(403).send({ error: "Schema injection requires Enterprise plan" });
  }

  const data = z.object({
    domain: z.string(),
    schemas: z.array(z.object({
      type: z.enum(["Organization", "WebSite", "LocalBusiness", "Product", "Article", "FAQPage", "BreadcrumbList", "Service"]),
      data: z.record(z.any())
    }))
  }).parse(request.body);

  return { success: true, workerUrl: `https://schema-${data.domain.replace(/[^a-z0-9]/gi, "-")}.workers.dev`, deployedSchemas: data.schemas.map(s => s.type) };
});

app.post("/api/payments/initiate", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string; userId: string; email: string; name: string; plan: string };
  const data = billingSchema.initiate.parse(request.body);

  const planPrices = { Starter: 4999, "Pro Growth": 12999, Enterprise: 29999 };
  const amount = planPrices[data.plan as keyof typeof planPrices];
  if (!amount) return reply.code(400).send({ error: "Invalid plan" });

  const finalAmount = data.interval === "yearly" ? Math.round(amount * 12 * 0.8) : amount;
  const fee = Math.round(finalAmount * 0.02);
  const totalAmount = finalAmount + fee;

  const orderId = `ord_${user.userId}_${data.plan}_${data.interval}_${Date.now()}`;

  // In production, integrate with eSewa/Khalti APIs here
  const paymentUrl = `${process.env.FRONTEND_URL}/dashboard/settings?payment=simulated&orderId=${orderId}&amount=${totalAmount}`;

  await db.insert(payments).values({
    id: createId(),
    workspaceId: user.workspaceId,
    provider: data.provider,
    orderId,
    paymentId: `pay_${createId()}`,
    amount: finalAmount,
    fee,
    totalAmount,
    currency: "NPR",
    plan: data.plan,
    interval: data.interval,
    status: "pending",
    customerInfo: { name: user.name || user.email || "OmniGEO Customer", email: user.email, phone: "" },
    metadata: { plan: data.plan, interval: data.interval, userId: user.userId }
  });

  return { success: true, paymentUrl, orderId, amount: finalAmount, fee, totalAmount };
});

app.post("/api/payments/verify", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const data = billingSchema.verify.parse(request.body);

  const payment = await db.select().from(payments).where(and(eq(payments.orderId, data.orderId), eq(payments.workspaceId, user.workspaceId))).limit(1);

  if (!payment[0]) return reply.code(404).send({ error: "Payment not found" });

  await db.update(payments).set({
    status: "completed",
    paymentId: data.paymentId,
    verifiedAt: new Date()
  }).where(eq(payments.id, payment[0].id));

  const planPrices = { Starter: 4999, "Pro Growth": 12999, Enterprise: 29999 };
  const finalAmount = payment[0].interval === "yearly" ? Math.round(planPrices[payment[0].plan as keyof typeof planPrices] * 12 * 0.8) : planPrices[payment[0].plan as keyof typeof planPrices];

  await db.update(workspaces).set({
    plan: payment[0].plan,
    billingInterval: payment[0].interval,
    billingCycleStart: new Date()
  }).where(eq(workspaces.id, user.workspaceId));

  await db.update(users).set({ plan: payment[0].plan }).where(eq(users.workspaceId, user.workspaceId));

  await db.insert(billingUsage).values({
    id: createId(),
    workspaceId: user.workspaceId,
    service: "payments",
    operation: `transaction_fee_${payment[0].provider}`,
    quantity: 1,
    costUsd: (payment[0].fee ?? 0) / 132,
    costNpr: payment[0].fee ?? 0,
    metadata: { amountNpr: finalAmount, provider: payment[0].provider }
  });

  return { success: true, verified: true, plan: payment[0].plan };
});

app.get("/api/billing/usage", { preHandler: [app.authenticate] }, async (request, reply) => {
  const { startDate, endDate, workspaceId } = request.query as Record<string, string>;

  const targetWorkspaceId = workspaceId || (request.user as any).workspaceId;
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const end = endDate || new Date().toISOString();

  const usage = await db.select().from(billingUsage)
    .where(and(
      eq(billingUsage.workspaceId, targetWorkspaceId),
      gte(billingUsage.createdAt, new Date(start)),
      lte(billingUsage.createdAt, new Date(end))
    ))
    .orderBy(desc(billingUsage.createdAt));

  const summary = usage.reduce((acc, record) => {
    if (!acc[record.service]) {
      acc[record.service] = { operations: 0, costUsd: 0, costNpr: 0 };
    }
    acc[record.service].operations += record.quantity ?? 0;
    acc[record.service].costUsd += record.costUsd ?? 0;
    acc[record.service].costNpr += record.costNpr ?? 0;
    return acc;
  }, {} as Record<string, { operations: number; costUsd: number; costNpr: number }>);

  return {
    summary: {
      period: { start, end },
      totalCostUsd: usage.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
      totalCostNpr: usage.reduce((sum, r) => sum + (r.costNpr ?? 0), 0),
      breakdown: Object.entries(summary).map(([service, data]) => ({ service, ...data }))
    },
    records: usage.slice(0, 100)
  };
});

app.get("/api/settings", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const settingsRow = await db.select().from(settings).where(eq(settings.workspaceId, user.workspaceId)).limit(1);

  const workspace = await db.select().from(workspaces).where(eq(workspaces.id, user.workspaceId)).limit(1);

  // The workspace row carries the account defaults (brand, category, tracked
  // domain); the settings row is the editable overlay on top of them.
  const workspaceSettings = (workspace[0]?.settings as Record<string, any>) || {};
  const overlay = (settingsRow[0]?.value as Record<string, any>) || {};

  return {
    workspace: workspace[0],
    settings: { ...workspaceSettings, ...overlay },
    domains: await db.select().from(domains).where(eq(domains.workspaceId, user.workspaceId))
  };
});

app.patch("/api/settings", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const body = request.body as Record<string, any>;

  // A layout arriving through the generic settings endpoint is normalised
  // here too, so a client cannot smuggle unknown block ids into storage.
  const data = body.dashboardLayout !== undefined
    ? { ...body, dashboardLayout: normalizeDashboardLayout(body.dashboardLayout) }
    : body;

  const existing = await db.select().from(settings).where(eq(settings.workspaceId, user.workspaceId)).limit(1);
  const merged = { ...((existing[0]?.value as Record<string, any>) || {}), ...data };

  if (existing[0]) {
    await db.update(settings).set({ value: merged, updatedAt: new Date() }).where(eq(settings.id, existing[0].id));
  } else {
    await db.insert(settings).values({
      id: createId(),
      workspaceId: user.workspaceId,
      key: "workspace_settings",
      value: merged
    });
  }

  if (data.whitelist) {
    await db.delete(domains).where(eq(domains.workspaceId, user.workspaceId));
    // The first entry is the primary domain — the one the dashboard reports
    // on and the crawler check reads.
    for (const [index, raw] of data.whitelist.entries()) {
      const normalized = String(raw).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      if (!normalized) continue;
      await db.insert(domains).values({
        id: createId(),
        workspaceId: user.workspaceId,
        domain: normalized,
        isPrimary: index === 0,
      });
    }
  }

  // The workspace row carries the same name the settings form edits, so keep
  // the two in step — otherwise a rename looks like it was never saved.
  if (typeof data.workspaceName === "string" && data.workspaceName.trim()) {
    await db
      .update(workspaces)
      .set({ name: data.workspaceName.trim().slice(0, 100), updatedAt: new Date() })
      .where(eq(workspaces.id, user.workspaceId));
  }

  return { success: true, settings: merged };
});

app.post("/api/api-keys", { preHandler: [app.authenticate] }, async (request, reply) => {
  const data = z.object({ name: z.string().min(2), permissions: z.array(z.string()).default(["read"]), expiresInDays: z.number().min(1).max(365).optional() }).parse(request.body);

  const { key, prefix, hash } = generateApiKey();
  const expiresAt = data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000) : null;

  await db.insert(apiKeys).values({
    id: createId(),
    workspaceId: request.user.workspaceId,
    name: data.name,
    keyHash: hash,
    keyPrefix: prefix,
    permissions: data.permissions,
    expiresAt
  });

  return { key: `${prefix}_${key}`, prefix, expiresAt };
});

app.get("/api/api-keys", { preHandler: [app.authenticate] }, async (request, reply) => {
  const keys = await db.select().from(apiKeys).where(eq(apiKeys.workspaceId, request.user.workspaceId)).orderBy(desc(apiKeys.createdAt));
  return { keys: keys.map(k => ({ ...k, keyHash: undefined, keyPrefix: undefined })) };
});

app.delete("/api/api-keys/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
  const { id } = z.object({ id: z.string() }).parse(request.params);
  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.workspaceId, request.user.workspaceId)));
  return { success: true };
});

app.post("/api/webhooks", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const data = z.object({ url: z.string().url(), events: z.array(z.string()), secret: z.string().optional() }).parse(request.body);

  const secret = data.secret || createId();
  await db.insert(webhooks).values({
    id: createId(),
    workspaceId: user.workspaceId,
    url: data.url,
    events: data.events,
    secret
  });

  return { success: true, secret };
});

app.get("/api/webhooks", { preHandler: [app.authenticate] }, async (request, reply) => {
  const hooks = await db.select().from(webhooks).where(eq(webhooks.workspaceId, request.user.workspaceId)).orderBy(desc(webhooks.createdAt));
  return { webhooks: hooks.map(h => ({ ...h, secret: undefined })) };
});

app.delete("/api/webhooks/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
  const { id } = z.object({ id: z.string() }).parse(request.params);
  await db.delete(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.workspaceId, request.user.workspaceId)));
  return { success: true };
});

app.post("/api/webhooks/incoming/:event", async (request, reply) => {
  const { event } = request.params as { event: string };
  const signature = request.headers["x-webhook-signature"] as string;
  const payload = JSON.stringify(request.body);

  const activeHooks = await db.select().from(webhooks).where(eq(webhooks.active, true));
  const webhooksList = activeHooks.filter((w) => Array.isArray(w.events) && w.events.includes(event));

  for (const webhook of webhooksList) {
    if (verifyWebhookSignature(JSON.stringify(request.body), signature, webhook.secret)) {
      try {
        await fetch(webhook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Webhook-Signature": signature },
          body: payload
        });
        await db.update(webhooks).set({ lastTriggeredAt: new Date(), failureCount: 0 }).where(eq(webhooks.id, webhook.id));
      } catch {
        await db.update(webhooks).set({ failureCount: sql`${webhooks.failureCount} + 1` }).where(eq(webhooks.id, webhook.id));
      }
    }
  }

  return { success: true };
});

app.get("/api/dashboard/layout", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const settingsRow = await db.select().from(settings).where(eq(settings.workspaceId, user.workspaceId)).limit(1);
  const stored = (settingsRow[0]?.value as Record<string, any>) || {};

  return {
    layout: normalizeDashboardLayout(stored.dashboardLayout),
    blocks: DASHBOARD_BLOCKS,
    groups: DASHBOARD_BLOCK_GROUPS,
    presets: DASHBOARD_PRESETS,
  };
});

app.patch("/api/dashboard/layout", { preHandler: [app.authenticate] }, async (request, reply) => {
  const user = request.user as { workspaceId: string };
  const layout = normalizeDashboardLayout(request.body);

  const existing = await db.select().from(settings).where(eq(settings.workspaceId, user.workspaceId)).limit(1);
  const merged = {
    ...((existing[0]?.value as Record<string, any>) || {}),
    dashboardLayout: layout,
  };

  if (existing[0]) {
    await db.update(settings).set({ value: merged, updatedAt: new Date() }).where(eq(settings.id, existing[0].id));
  } else {
    await db.insert(settings).values({
      id: createId(),
      workspaceId: user.workspaceId,
      key: "workspace_settings",
      value: merged,
    });
  }

  return { success: true, layout };
});

// Contact requests are unauthenticated — they come from the public marketing
// site, so there is no session to require.
app.post("/api/contact", async (request, reply) => {
  const data = z.object({
    intent: z.string().max(60).optional(),
    name: z.string().min(1).max(120),
    email: z.string().email().max(200),
    company: z.string().min(1).max(160),
    website: z.string().max(300).optional(),
    teamSize: z.string().max(60).optional(),
    budget: z.string().max(60).optional(),
    message: z.string().max(4000).optional(),
  }).safeParse(request.body);

  if (!data.success) {
    return reply.code(400).send({ error: "Please provide your name, work email and company." });
  }

  const inserted = await db.insert(contactRequests).values({
    id: createId(),
    intent: data.data.intent ?? "general",
    name: data.data.name,
    email: data.data.email,
    company: data.data.company,
    website: data.data.website,
    teamSize: data.data.teamSize,
    budget: data.data.budget,
    message: data.data.message,
  }).returning();

  request.log.info({ contactId: inserted[0]?.id, intent: inserted[0]?.intent }, "contact request received");

  return { success: true, id: inserted[0]?.id };
});

app.get("/api/contact", { preHandler: [app.authenticate] }, async (request, reply) => {
  const rows = await db
    .select()
    .from(contactRequests)
    .orderBy(desc(contactRequests.createdAt))
    .limit(100);
  return { success: true, requests: rows };
});

app.get("/health", async () => ({ status: "ok", timestamp: Date.now() }));

const PORT = parseInt(process.env.PORT || "3001");
const HOST = "0.0.0.0";

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`Server running at http://${HOST}:${PORT}`);
} catch (err) {
  console.error("Failed to start server:", err);
  process.exit(1);
}