/**
 * End-to-end smoke test for the OmniGEO backend engine.
 * Usage: npx tsx scripts/smoke-test.ts
 */

const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3001";
let token = "";
let cookie = "";

function log(label: string, ok: boolean, detail?: unknown) {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${label}${detail !== undefined ? ` -> ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function api(path: string, options: { method?: string; body?: unknown; auth?: boolean } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;
  if (options.auth !== false && cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method: options.method || "POST",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length > 0) {
    cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  }
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

async function waitForScan(scanId: string, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await api(`/api/scans/${scanId}`, { method: "GET" });
    const scan = res.body?.scan;
    if (scan && (scan.status === "completed" || scan.status === "failed")) return scan;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Scan ${scanId} did not finish within ${timeoutMs}ms`);
}

async function main() {
  console.log(`\n=== OmniGEO backend smoke test (${BASE}) ===\n`);

  // 1. Health
  const health = await api("/health", { method: "GET", auth: false });
  log("GET /health", health.status === 200 && health.body?.status === "ok", health.body);

  // 2. Login with seeded demo user
  const login = await api("/api/auth/login", { body: { email: "demo@omnigeo.ai", password: "demo1234" }, auth: false });
  token = login.body?.token || "";
  log(
    "POST /api/auth/login",
    login.status === 200 && (!!token || !!cookie),
    { user: login.body?.user?.email, session: token ? "bearer token" : cookie ? "cookie" : "none" }
  );

  // 3. Auth me
  const me = await api("/api/auth/me", { method: "GET" });
  log("GET /api/auth/me", me.status === 200 && me.body?.user?.workspaceId, me.body?.user);

  // 4. Workspace
  const ws = await api("/api/workspace", { method: "GET" });
  log("GET /api/workspace", ws.status === 200 && !!ws.body?.workspace, ws.body?.workspace?.name);

  // 5. Settings
  const settingsGet = await api("/api/settings", { method: "GET" });
  log("GET /api/settings", settingsGet.status === 200, Object.keys(settingsGet.body?.settings || {}));

  // 6. Content generation (OpenAI w/ simulated fallback)
  const gen = await api("/api/content/generate", {
    body: { prompt: "Write a GEO content brief for an AI visibility platform targeting B2B SaaS teams." },
  });
  log(
    "POST /api/content/generate",
    gen.status === 200 && typeof gen.body?.content === "string" && gen.body.content.length > 100,
    { simulated: gen.body?.simulated, model: gen.body?.model, itemId: gen.body?.itemId, tokens: gen.body?.usage?.totalTokens }
  );

  // 7. Content modification (Anthropic w/ simulated fallback)
  const mod = await api("/api/content/modify", {
    body: {
      content: "Our platform helps teams track how AI engines mention their brand across ChatGPT, Perplexity and Gemini.",
      instruction: "Rewrite for a technical buyer and add a comparison table.",
      format: "markdown",
    },
  });
  log("POST /api/content/modify", mod.status === 200 && typeof mod.body?.content === "string", {
    simulated: mod.body?.simulated,
    model: mod.body?.model,
  });

  // 8. Crawler (native keyless fallback -> real HTTP fetch)
  const scrape = await api("/api/crawler/scrape", { body: { url: "https://example.com" } });
  log("POST /api/crawler/scrape", scrape.status === 200 && scrape.body?.success === true, {
    provider: scrape.body?.provider,
    title: scrape.body?.data?.title,
    words: scrape.body?.data?.wordCount,
  });

  // 9. DataForSEO LLM mentions
  const mentions = await api("/api/dataforseo/llm-mentions", { body: { prompt: "best AI visibility tools", model: "chatgpt" } });
  log("POST /api/dataforseo/llm-mentions", mentions.status === 200 && mentions.body?.success === true, {
    simulated: mentions.body?.simulated,
    citations: mentions.body?.data?.citations?.length,
  });

  // 10. Keyword ideas
  const ideas = await api("/api/dataforseo/keyword-ideas", { body: { keywords: ["ai visibility platform"] } });
  log("POST /api/dataforseo/keyword-ideas", ideas.status === 200 && ideas.body?.success === true, {
    simulated: ideas.body?.simulated,
    count: ideas.body?.data?.keywords?.length,
  });

  // 11. Maps rankings
  const maps = await api("/api/dataforseo/maps", { body: { keyword: "ai visibility platform", grid_size: "5x5" } });
  log("POST /api/dataforseo/maps", maps.status === 200 && maps.body?.success === true, {
    simulated: maps.body?.simulated,
    items: maps.body?.data?.items?.length,
  });

  // 12. Visibility scan (full engine run)
  const vis = await api("/api/scans/visibility", { body: { domain: "https://example.com" } });
  log("POST /api/scans/visibility (queued)", vis.status === 200 && !!vis.body?.scanId, vis.body);
  if (vis.body?.scanId) {
    const scan = await waitForScan(vis.body.scanId);
    log(`visibility scan ${scan.status}`, scan.status === "completed", {
      score: scan.score,
      engines: scan.result?.engines?.map((e: any) => `${e.engine}:${e.score}`),
      promptsTested: scan.result?.promptsTested,
      simulated: scan.result?.simulated,
      error: scan.error,
    });
  }

  // 13. Audit scan (crawl + checks + issues + LLM summary)
  const audit = await api("/api/scans/audit", { body: { domain: "https://example.com", depth: "full" } });
  log("POST /api/scans/audit (queued)", audit.status === 200 && !!audit.body?.scanId, audit.body);
  if (audit.body?.scanId) {
    const scan = await waitForScan(audit.body.scanId);
    log(`audit scan ${scan.status}`, scan.status === "completed", {
      score: scan.score,
      pagesAnalyzed: scan.pagesAnalyzed,
      issuesFound: scan.issuesFound,
      checks: scan.checks?.map((c: any) => `${c.name}=${c.status}`),
      summary: typeof scan.result?.summary === "string" ? scan.result.summary.slice(0, 120) : undefined,
      error: scan.error,
    });
  }

  // 14. Crawler scan (persisted crawl rows)
  const crawlScan = await api("/api/scans/crawler", { body: { urls: ["https://example.com", "https://www.iana.org"], onlyMainContent: true } });
  log("POST /api/scans/crawler (queued)", crawlScan.status === 200 && !!crawlScan.body?.scanId, crawlScan.body);
  if (crawlScan.body?.scanId) {
    const scan = await waitForScan(crawlScan.body.scanId);
    log(`crawler scan ${scan.status}`, scan.status === "completed", {
      pages: scan.result?.pages,
      succeeded: scan.result?.succeeded,
      failed: scan.result?.failed,
      provider: scan.result?.provider,
      error: scan.error,
    });
  }

  // 15. Scan list + detail
  const list = await api("/api/scans?limit=5", { method: "GET" });
  log("GET /api/scans", list.status === 200 && Array.isArray(list.body?.scans), { count: list.body?.scans?.length });

  // 16. Billing usage reflects engine spend
  const usage = await api("/api/billing/usage", { method: "GET" });
  log("GET /api/billing/usage", usage.status === 200, {
    services: usage.body?.summary?.breakdown?.map((b: any) => `${b.service}:${b.operations}`),
    totalNpr: usage.body?.summary?.totalCostNpr,
  });

  // 17. Change-password bug regression (the eq(users.id, user) fix)
  const cp = await api("/api/auth/change-password", { body: { currentPassword: "demo1234", newPassword: "demo1234" } });
  log("POST /api/auth/change-password", cp.status === 200 && cp.body?.success === true, cp.body);

  // 18. Settings write
  const patch = await api("/api/settings", { method: "PATCH", body: { digestFrequency: "weekly", alertThreshold: 70 } });
  log("PATCH /api/settings", patch.status === 200 && patch.body?.success === true, patch.body);

  console.log(`\n=== done (exit code ${process.exitCode ?? 0}) ===\n`);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
