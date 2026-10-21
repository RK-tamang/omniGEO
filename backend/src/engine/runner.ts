/**
 * OmniGEO scan engine.
 * Executes scan jobs asynchronously and persists results into `scans`,
 * `prompts`, `citations`, `crawls`, `audit_issues` and `billing_usage`.
 *
 * Providers resolve automatically: live API keys are used when configured,
 * otherwise the engine degrades to free/native or deterministic simulated
 * results (always flagged in the scan result payload).
 */

import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { scans, prompts, citations, crawls, auditIssues, billingUsage } from "../db/schema.js";
import type { Scan } from "../db/schema.js";
import { scrapeUrl, scrapeBulk, fetchTextResource, type CrawlerProvider } from "../services/crawler.js";
import { getLLMMentions } from "../services/dataforseo.js";
import { generateContent, usdToNpr } from "../services/llm.js";

type Engine = "chatgpt" | "perplexity" | "gemini" | "aio";
type CheckStatus = "pass" | "warn" | "fail";

interface Check {
  name: string;
  status: CheckStatus;
  details: string;
}

interface IssueSeed {
  category: string;
  severity: "Critical" | "Warning" | "Notice" | "Good";
  title: string;
  description: string;
  fix: string;
  impact?: string;
  effort?: string;
}

interface ScanUpdate {
  result?: Record<string, any>;
  score?: number;
  checks?: Check[];
  pagesAnalyzed?: number;
  issuesFound?: number;
  creditsUsed?: number;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Run a queued scan to completion. Errors are recorded on the scan row. */
export async function runScan(scanId: string): Promise<void> {
  const rows = await db.select().from(scans).where(eq(scans.id, scanId)).limit(1);
  const scan = rows[0];
  if (!scan) return;

  await db.update(scans).set({ status: "running", startedAt: new Date() }).where(eq(scans.id, scanId));

  try {
    let update: ScanUpdate;
    switch (scan.type) {
      case "visibility":
        update = await runVisibilityScan(scan);
        break;
      case "audit":
        update = await runAuditScan(scan);
        break;
      case "crawler":
        update = await runCrawlerScan(scan);
        break;
      case "schema":
        update = await runSchemaScan(scan);
        break;
      case "content":
        update = await runContentScan(scan);
        break;
      default:
        throw new Error(`Unsupported scan type "${scan.type}"`);
    }

    await db
      .update(scans)
      .set({ ...update, status: "completed", completedAt: new Date(), error: null })
      .where(eq(scans.id, scanId));
  } catch (error: any) {
    const message = error?.message || "Scan failed unexpectedly";
    await db
      .update(scans)
      .set({ status: "failed", error: message, completedAt: new Date() })
      .where(eq(scans.id, scanId));
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function recordUsage(
  workspaceId: string,
  service: string,
  operation: string,
  quantity: number,
  costUsd: number,
  metadata?: Record<string, any>
): Promise<void> {
  await db.insert(billingUsage).values({
    workspaceId,
    service,
    operation,
    quantity,
    costUsd: Math.round(costUsd * 1e6) / 1e6,
    costNpr: usdToNpr(costUsd),
    metadata,
  });
}

function normalizeOrigin(raw: string): string {
  let value = String(raw || "").trim();
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  return new URL(value).origin;
}

function hostnameOf(raw: string): string {
  try {
    return normalizeOrigin(raw).replace(/^https?:\/\//, "").toLowerCase();
  } catch {
    return String(raw || "").toLowerCase();
  }
}

function matchesDomain(candidate: string, tracked: string): boolean {
  const d = String(candidate || "").toLowerCase().replace(/^www\./, "");
  const t = tracked.toLowerCase().replace(/^www\./, "");
  if (!d || !t) return false;
  return d === t || d.endsWith(`.${t}`) || t.endsWith(`.${d}`);
}

function truncate(value: string | undefined, max: number): string {
  if (!value) return "";
  return value.length > max ? value.slice(0, max) : value;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

// ---------------------------------------------------------------------------
// Visibility scan: prompt x engine citation tracking
// ---------------------------------------------------------------------------

const DEFAULT_PROMPT_TEMPLATES = (brand: string) => [
  `What are the best ${brand} alternatives?`,
  `Top recommended tools like ${brand}`,
  `Is ${brand} worth it? Reviews and pricing`,
  `How does ${brand} compare to competitors?`,
  `Best solutions for teams considering ${brand}`,
];

function inferPromptType(query: string, brand: string): "Category" | "Comparison" | "Problem" | "Brand" | "Question" | "How-to" {
  const q = query.toLowerCase();
  if (/\bvs\.?\b|\bversus\b/.test(q)) return "Comparison";
  if (q.startsWith("how ")) return "How-to";
  if (/^(best|top)\b/.test(q)) return "Category";
  if (/alternativ|instead of|replace|switch/.test(q)) return "Problem";
  if (brand && q.includes(brand.toLowerCase())) return "Brand";
  return "Question";
}

async function resolvePromptQueries(workspaceId: string, inputPrompts: unknown, brand: string): Promise<string[]> {
  if (Array.isArray(inputPrompts) && inputPrompts.length > 0) {
    return dedupe(inputPrompts.map(String)).slice(0, 12);
  }
  const existing = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.workspaceId, workspaceId), eq(prompts.status, "active")))
    .limit(10);
  return dedupe([...existing.map((p) => p.prompt), ...DEFAULT_PROMPT_TEMPLATES(brand)]).slice(0, 12);
}

async function runVisibilityScan(scan: Scan): Promise<ScanUpdate> {
  const input = scan.input || {};
  const trackedDomain = hostnameOf(String(input.domain || ""));
  if (!trackedDomain) throw new Error("Visibility scan is missing a domain");

  const brand = trackedDomain.split(".")[0];
  const engines: Engine[] = Array.isArray(input.engines) && input.engines.length
    ? (input.engines as Engine[])
    : ["chatgpt", "perplexity", "gemini", "aio"];

  const queryList = await resolvePromptQueries(scan.workspaceId, input.prompts, brand);

  const stats: Record<Engine, { cited: number; mentioned: number; missing: number; topCitations: string[] }> = {} as any;
  for (const engine of engines) stats[engine] = { cited: 0, mentioned: 0, missing: 0, topCitations: [] };

  let simulated = true;
  const creditsByEngine: Record<string, number> = {};

  for (const query of queryList) {
    let promptRow = (
      await db
        .select()
        .from(prompts)
        .where(and(eq(prompts.workspaceId, scan.workspaceId), eq(prompts.prompt, query)))
        .limit(1)
    )[0];

    if (!promptRow) {
      const [inserted] = await db
        .insert(prompts)
        .values({
          workspaceId: scan.workspaceId,
          prompt: query,
          type: inferPromptType(query, brand),
          engines: {},
        })
        .returning();
      promptRow = inserted;
    }

    const engineStatuses: Record<string, "cited" | "mentioned" | "missing"> = { ...(promptRow.engines || {}) };

    for (const engine of engines) {
      const mention = await getLLMMentions({
        prompt: query,
        model: engine === "aio" ? "google_ai_overview" : engine,
      });

      creditsByEngine[engine] = (creditsByEngine[engine] || 0) + mention.creditsUsed;
      if (!mention.simulated) simulated = false;

      let status: "cited" | "mentioned" | "missing" = "missing";
      if (mention.success) {
        const ourCitations = mention.citations.filter((c) => matchesDomain(c.domain, trackedDomain));
        const brandPattern = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        const answerMentionsBrand = brandPattern.test(mention.answer || "");

        if (ourCitations.length > 0) {
          status = "cited";
          for (const c of ourCitations) {
            const exists = await db
              .select({ id: citations.id })
              .from(citations)
              .where(
                and(
                  eq(citations.promptId, promptRow.id),
                  eq(citations.engine, engine),
                  eq(citations.url, c.url)
                )
              )
              .limit(1);
            if (exists.length === 0) {
              await db.insert(citations).values({
                workspaceId: scan.workspaceId,
                promptId: promptRow.id,
                engine,
                domain: trackedDomain,
                url: c.url,
                title: c.title,
                position: c.position,
                snippet: truncate(mention.answer, 300),
              });
            }
            if (!stats[engine].topCitations.includes(c.url)) stats[engine].topCitations.push(c.url);
          }
        } else if (answerMentionsBrand) {
          status = "mentioned";
        }
      }

      engineStatuses[engine] = status;
      stats[engine][status] += 1;
    }

    await db
      .update(prompts)
      .set({ engines: engineStatuses, updatedAt: new Date() })
      .where(eq(prompts.id, promptRow.id));
  }

  const httpCostPerCall = 0.01;
  const callsMade = Object.values(creditsByEngine).reduce((a, b) => a + b, 0);
  await recordUsage(
    scan.workspaceId,
    "dataforseo",
    "llm_api",
    callsMade,
    simulated ? 0 : callsMade * httpCostPerCall,
    { engines, promptsTested: queryList.length, simulated }
  );

  const engineResults = engines.map((engine) => {
    const s = stats[engine];
    const tested = s.cited + s.mentioned + s.missing;
    const score = tested > 0 ? Math.round(((s.cited * 100 + s.mentioned * 50) / tested)) : 0;
    return { engine, score, promptsTested: tested, ...s };
  });
  const overall =
    engineResults.length > 0
      ? Math.round(engineResults.reduce((sum, r) => sum + r.score, 0) / engineResults.length)
      : 0;

  return {
    score: overall,
    creditsUsed: Object.values(creditsByEngine).reduce((a, b) => a + b, 0),
    result: {
      domain: trackedDomain,
      brand,
      promptsTested: queryList.length,
      engines: engineResults,
      overallVisibilityScore: overall,
      simulated,
    },
  };
}

// ---------------------------------------------------------------------------
// Audit scan: crawl homepage (+ llms.txt/robots/sitemap checks) -> score & issues
// ---------------------------------------------------------------------------

interface AuditSpec {
  category: string;
  title: string;
  fix: string;
  impact: string;
  effort: "Low" | "Medium" | "High";
  failSeverity?: "Critical" | "Warning";
}

const AUDIT_SPECS: Record<string, AuditSpec> = {
  HTTPS: {
    category: "Technical SEO",
    title: "Site is not served over HTTPS",
    fix: "Provision a TLS certificate and redirect all HTTP traffic to HTTPS.",
    impact: "Trust and ranking signal for answer engines",
    effort: "Low",
  },
  "robots.txt": {
    category: "Crawler Access",
    title: "robots.txt is missing or invalid",
    fix: "Publish a robots.txt that allows AI crawlers (GPTBot, PerplexityBot, Google-Extended).",
    impact: "Answer engines may skip your site entirely",
    effort: "Low",
  },
  "sitemap.xml": {
    category: "Crawler Access",
    title: "XML sitemap not found",
    fix: "Generate sitemap.xml and reference it from robots.txt.",
    impact: "Discovery and crawl coverage",
    effort: "Low",
  },
  "llms.txt": {
    category: "AI Readiness",
    title: "llms.txt is missing",
    fix: "Add an /llms.txt file summarizing key pages for LLM crawlers (llmstxt.org).",
    impact: "Improved context for AI answer engines",
    effort: "Low",
    failSeverity: "Warning",
  },
  "Title tag": {
    category: "On-Page SEO",
    title: "Title tag missing or wrong length",
    fix: "Write a unique title of 10-65 characters containing the primary entity.",
    impact: "Snippet & citation selection",
    effort: "Low",
  },
  "Meta description": {
    category: "On-Page SEO",
    title: "Meta description missing or wrong length",
    fix: "Add a 50-160 character meta description that answers the page query directly.",
    impact: "Extractable answer snippet",
    effort: "Low",
  },
  "H1 heading": {
    category: "Content Structure",
    title: "H1 heading missing or duplicated",
    fix: "Ensure exactly one H1 that states the page's primary question/answer.",
    impact: "Topic clarity for crawlers",
    effort: "Low",
  },
  "Structured data (JSON-LD)": {
    category: "Structured Data",
    title: "No JSON-LD structured data found",
    fix: "Add Organization + WebSite (+ Article/FAQPage) JSON-LD to the page head.",
    impact: "Rich results and entity understanding",
    effort: "Medium",
  },
  Canonical: {
    category: "Technical SEO",
    title: "Canonical link missing",
    fix: 'Add <link rel="canonical" href="..."> pointing at the preferred URL.',
    impact: "Duplicate-content consolidation",
    effort: "Low",
  },
  "Open Graph tags": {
    category: "Content Structure",
    title: "Open Graph tags incomplete",
    fix: "Add og:title and og:description meta tags.",
    impact: "Share/citation preview quality",
    effort: "Low",
  },
  "HTML lang attribute": {
    category: "Technical SEO",
    title: "HTML lang attribute missing",
    fix: 'Set <html lang="en"> (or the correct language) on the document.',
    impact: "Language targeting for answer engines",
    effort: "Low",
  },
  "Content depth": {
    category: "Content",
    title: "Thin content on homepage",
    fix: "Expand to at least 300 words of indexable, extractable body copy.",
    impact: "Ability to answer prompts from the page",
    effort: "Medium",
  },
  "Question-form headings": {
    category: "AI Readiness",
    title: "No question-form headings found",
    fix: "Add H2s phrased as the questions users ask AI engines (who/what/how/is).",
    impact: "Direct answer extraction",
    effort: "Medium",
  },
  FAQSection: {
    category: "AI Readiness",
    title: "No FAQ section or FAQPage schema",
    fix: "Add an FAQ block with FAQPage JSON-LD markup.",
    impact: "Lifts answers verbatim into AI responses",
    effort: "Medium",
  },
  "List formatting": {
    category: "Content",
    title: "Sparse use of lists",
    fix: "Break key facts, steps and comparisons into bullet/numbered lists.",
    impact: "Lists are preferred for answer extraction",
    effort: "Low",
  },
};

function makeCheck(
  name: string,
  status: CheckStatus,
  details: string,
  checks: Check[],
  issues: IssueSeed[]
): void {
  checks.push({ name, status, details });
  if (status === "pass") return;
  const spec = AUDIT_SPECS[name];
  if (!spec) return;
  issues.push({
    category: spec.category,
    severity: status === "fail" ? spec.failSeverity || "Critical" : "Warning",
    title: spec.title,
    description: details,
    fix: spec.fix,
    impact: spec.impact,
    effort: spec.effort,
  });
}

async function runAuditScan(scan: Scan): Promise<ScanUpdate> {
  const input = scan.input || {};
  const origin = normalizeOrigin(String(input.domain || input.url || ""));
  const depth = String(input.depth || "full");

  const homepage = await scrapeUrl(origin, { onlyMainContent: false });
  if (!homepage.success || !homepage.data) {
    throw new Error(`Could not crawl ${origin}: ${homepage.error || "unknown crawler error"}`);
  }
  const page = homepage.data;

  const [robots, sitemap, llms] = await Promise.all([
    fetchTextResource(`${origin}/robots.txt`),
    fetchTextResource(`${origin}/sitemap.xml`),
    fetchTextResource(`${origin}/llms.txt`),
  ]);

  const checks: Check[] = [];
  const issues: IssueSeed[] = [];

  // --- infrastructure checks -------------------------------------------------
  makeCheck(
    "HTTPS",
    origin.startsWith("https://") ? "pass" : "fail",
    origin.startsWith("https://") ? `Served over HTTPS (${origin})` : `${origin} is not HTTPS-secured`,
    checks,
    issues
  );
  makeCheck(
    "robots.txt",
    robots.ok && /user-agent/i.test(robots.body) ? "pass" : "fail",
    robots.ok ? "robots.txt found and readable" : `robots.txt returned HTTP ${robots.status || "error"}`,
    checks,
    issues
  );
  makeCheck(
    "sitemap.xml",
    sitemap.ok ? "pass" : "fail",
    sitemap.ok ? "sitemap.xml found and readable" : `sitemap.xml returned HTTP ${sitemap.status || "error"}`,
    checks,
    issues
  );
  makeCheck(
    "llms.txt",
    llms.ok ? "pass" : "fail",
    llms.ok ? "llms.txt found - LLM crawlers can index your content map" : `llms.txt returned HTTP ${llms.status || "error"}`,
    checks,
    issues
  );

  // --- on-page checks --------------------------------------------------------
  const title = page.title || "";
  makeCheck(
    "Title tag",
    !title ? "fail" : title.length >= 10 && title.length <= 65 ? "pass" : "warn",
    !title
      ? "No <title> tag found"
      : title.length >= 10 && title.length <= 65
        ? `Title present (${title.length} chars): "${truncate(title, 80)}"`
        : `Title length ${title.length} outside recommended 10-65 chars`,
    checks,
    issues
  );

  const description = page.description || "";
  makeCheck(
    "Meta description",
    !description ? "fail" : description.length >= 50 && description.length <= 160 ? "pass" : "warn",
    !description
      ? "No meta description found"
      : description.length >= 50 && description.length <= 160
        ? `Meta description present (${description.length} chars)`
        : `Meta description length ${description.length} outside recommended 50-160 chars`,
    checks,
    issues
  );

  const h1Count = page.html ? (page.html.match(/<h1[\s>]/gi) || []).length : 0;
  makeCheck(
    "H1 heading",
    h1Count === 1 ? "pass" : h1Count === 0 ? "fail" : "warn",
    h1Count === 1 ? "Exactly one H1 present" : `Found ${h1Count} H1 tags (expected exactly 1)`,
    checks,
    issues
  );

  const jsonLd = page.metadata.jsonLd || [];
  makeCheck(
    "Structured data (JSON-LD)",
    jsonLd.length > 0 ? "pass" : "fail",
    jsonLd.length > 0
      ? `${jsonLd.length} JSON-LD block(s) found`
      : "No application/ld+json blocks detected",
    checks,
    issues
  );

  makeCheck(
    "Canonical",
    page.metadata.canonical ? "pass" : "warn",
    page.metadata.canonical ? `Canonical: ${page.metadata.canonical}` : "No canonical link tag found",
    checks,
    issues
  );

  const hasOg = Boolean(page.metadata.ogTitle && page.metadata.ogDescription);
  makeCheck(
    "Open Graph tags",
    hasOg ? "pass" : "warn",
    hasOg ? "og:title and og:description present" : "og:title/og:description missing or incomplete",
    checks,
    issues
  );

  makeCheck(
    "HTML lang attribute",
    page.metadata.language ? "pass" : "warn",
    page.metadata.language ? `lang="${page.metadata.language}"` : "No lang attribute on <html>",
    checks,
    issues
  );

  makeCheck(
    "Content depth",
    page.wordCount >= 300 ? "pass" : page.wordCount >= 150 ? "warn" : "fail",
    `${page.wordCount} words of indexable content (target: 300+)`,
    checks,
    issues
  );

  // --- depth: crawl a few internal pages ------------------------------------
  const extraPages: Array<{ url: string; title: string; wordCount: number }> = [];
  if (depth === "deep") {
    const skip = /\.(png|jpe?g|gif|svg|webp|css|js|pdf|zip|mp4|woff2?)$/i;
    const internal = page.links
      .filter((l) => matchesDomain(hostnameOf(l.url), hostnameOf(origin)) && !skip.test(l.url) && l.url !== origin + "/")
      .slice(0, 3);
    for (const link of internal) {
      const result = await scrapeUrl(link.url, { onlyMainContent: true });
      if (result.success && result.data) {
        extraPages.push({ url: link.url, title: result.data.title, wordCount: result.data.wordCount });
      }
    }
  }

  // --- scoring ---------------------------------------------------------------
  const failed = checks.filter((c) => c.status === "fail").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  const score = Math.max(0, 100 - failed * 8 - warned * 3);

  // --- persist issues --------------------------------------------------------
  if (issues.length > 0) {
    await db.insert(auditIssues).values(
      issues.map((issue) => ({
        workspaceId: scan.workspaceId,
        scanId: scan.id,
        category: issue.category,
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        fix: issue.fix,
        pagesAffected: 1 + extraPages.length,
        impact: issue.impact,
        effort: issue.effort,
        status: "open" as const,
      }))
    );
  }

  // --- LLM summary -----------------------------------------------------------
  const summaryResult = await generateContent({
    prompt: [
      `You are auditing a website for Generative Engine Optimization (GEO).`,
      `Site: ${origin}`,
      `Score: ${score}/100 (${failed} failed checks, ${warned} warnings).`,
      `Checks: ${checks.map((c) => `${c.name}=${c.status} (${c.details})`).join("; ")}`,
      `Write a max 120-word executive summary with the single highest-impact fix.`,
    ].join("\n"),
    maxTokens: 400,
    temperature: 0.3,
  });
  await recordUsage(scan.workspaceId, "openai", "audit_summary", 1, summaryResult.usage.estimatedCost, {
    model: summaryResult.model,
    simulated: summaryResult.simulated,
  });

  const pagesAnalyzed = 1 + extraPages.length;
  if (homepage.creditsUsed > 0) {
    await recordUsage(
      scan.workspaceId,
      homepage.provider,
      "audit_scrape",
      homepage.creditsUsed * pagesAnalyzed,
      homepage.creditsUsed * pagesAnalyzed * 0.001,
      { origin, depth }
    );
  }

  return {
    score,
    checks,
    pagesAnalyzed,
    issuesFound: issues.length,
    creditsUsed: homepage.creditsUsed * pagesAnalyzed,
    result: {
      domain: hostnameOf(origin),
      score,
      summary: summaryResult.content,
      summarySimulated: summaryResult.simulated,
      checks,
      resources: {
        robots: { ok: robots.ok, status: robots.status },
        sitemap: { ok: sitemap.ok, status: sitemap.status },
        llmsTxt: { ok: llms.ok, status: llms.status },
      },
      pages: [
        { url: origin, title: page.title, wordCount: page.wordCount },
        ...extraPages,
      ],
      provider: homepage.provider,
      depth,
      crawledAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Crawler scan: scrape URL(s) and store results in `crawls`
// ---------------------------------------------------------------------------

async function runCrawlerScan(scan: Scan): Promise<ScanUpdate> {
  const input = scan.input || {};
  const rawUrls =
    Array.isArray(input.urls) && input.urls.length > 0
      ? input.urls
      : [String(input.url || "").trim()].filter(Boolean);
  const urls = dedupe(rawUrls.map(String)).slice(0, 25);
  if (urls.length === 0) throw new Error("Crawler scan is missing a URL");

  const provider = input.provider ? (input.provider as CrawlerProvider) : undefined;
  const results = await scrapeBulk(urls, {
    provider,
    onlyMainContent: input.onlyMainContent !== false,
  });

  let succeeded = 0;
  let creditsUsed = 0;
  const crawlSummaries: Array<Record<string, any>> = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const url = urls[i];
    creditsUsed += r.creditsUsed;

    const [row] = await db
      .insert(crawls)
      .values({
        workspaceId: scan.workspaceId,
        url,
        status: r.success ? "completed" : "failed",
        format: (input.format || "markdown") as any,
        result: r.data
          ? {
              title: r.data.title,
              description: r.data.description,
              markdown: truncate(r.data.markdown, 300_000),
              html: truncate(r.data.html, 300_000),
              links: r.data.links.slice(0, 200),
              metadata: r.data.metadata,
              screenshot: r.data.screenshot,
            }
          : undefined,
        error: r.error,
        pagesCrawled: r.success ? 1 : 0,
        creditsUsed: r.creditsUsed,
        startedAt: new Date(),
        completedAt: new Date(),
      })
      .returning();

    if (r.success) succeeded++;
    crawlSummaries.push({
      id: row.id,
      url,
      success: r.success,
      title: r.data?.title || "",
      wordCount: r.data?.wordCount || 0,
      linkCount: r.data?.links.length || 0,
      provider: r.provider,
      error: r.error,
    });

    await recordUsage(scan.workspaceId, r.provider, "scrape", 1, r.creditsUsed * 0.001, { url });
  }

  if (succeeded === 0) {
    const firstError = results.find((r) => r.error)?.error || "unknown error";
    throw new Error(`All ${urls.length} URL(s) failed to crawl: ${firstError}`);
  }

  return {
    pagesAnalyzed: succeeded,
    creditsUsed,
    result: {
      pages: urls.length,
      succeeded,
      failed: urls.length - succeeded,
      provider: results[0]?.provider,
      crawledAt: new Date().toISOString(),
      crawls: crawlSummaries,
    },
  };
}

// ---------------------------------------------------------------------------
// Schema scan: validate JSON-LD coverage on the homepage
// ---------------------------------------------------------------------------

async function runSchemaScan(scan: Scan): Promise<ScanUpdate> {
  const input = scan.input || {};
  const origin = normalizeOrigin(String(input.domain || input.url || ""));

  const homepage = await scrapeUrl(origin, { onlyMainContent: false });
  if (!homepage.success || !homepage.data) {
    throw new Error(`Could not crawl ${origin}: ${homepage.error || "unknown crawler error"}`);
  }

  const blocks = homepage.data.metadata.jsonLd || [];
  const flatTypes: string[] = [];
  const collectTypes = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(collectTypes);
    if (node["@type"]) {
      const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      for (const t of types) if (typeof t === "string" && !flatTypes.includes(t)) flatTypes.push(t);
    }
    if (node["@graph"]) collectTypes(node["@graph"]);
  };
  blocks.forEach(collectTypes);

  const recommended = ["Organization", "WebSite"];
  const missing = recommended.filter((t) => !flatTypes.includes(t));
  const hasArticle = flatTypes.some((t) => /Article|BlogPosting|TechArticle/.test(t));
  const hasFaq = flatTypes.includes("FAQPage");
  const hasBreadcrumb = flatTypes.includes("BreadcrumbList");

  const checks: Check[] = [];
  const issues: IssueSeed[] = [];
  makeCheck(
    "Structured data (JSON-LD)",
    blocks.length > 0 ? "pass" : "fail",
    blocks.length > 0
      ? `${blocks.length} block(s), types: ${flatTypes.join(", ") || "unknown"}`
      : "No JSON-LD found on homepage",
    checks,
    issues
  );
  for (const type of missing) {
    checks.push({ name: `${type} schema`, status: "fail", details: `${type} schema not found` });
    issues.push({
      category: "Structured Data",
      severity: "Critical",
      title: `${type} schema missing`,
      description: `Answer engines use ${type} JSON-LD to resolve your entity.`,
      fix: `Add a ${type} JSON-LD block to the page head.`,
      impact: "Entity resolution & rich results",
      effort: "Medium",
    });
  }
  if (!hasFaq) {
    checks.push({ name: "FAQPage schema", status: "warn", details: "No FAQPage schema found" });
    issues.push({
      category: "Structured Data",
      severity: "Warning",
      title: "FAQPage schema missing",
      description: "FAQ markup lets AI engines lift answers verbatim.",
      fix: "Add FAQPage JSON-LD covering your top 4-6 questions.",
      impact: "Answer extraction in AI engines",
      effort: "Medium",
    });
  }

  const score = Math.max(
    0,
    100 - checks.filter((c) => c.status === "fail").length * 20 - checks.filter((c) => c.status === "warn").length * 10
  );

  if (issues.length > 0) {
    await db.insert(auditIssues).values(
      issues.map((issue) => ({
        workspaceId: scan.workspaceId,
        scanId: scan.id,
        category: issue.category,
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        fix: issue.fix,
        pagesAffected: 1,
        impact: issue.impact,
        effort: issue.effort,
        status: "open" as const,
      }))
    );
  }

  if (homepage.creditsUsed > 0) {
    await recordUsage(scan.workspaceId, homepage.provider, "schema_scrape", homepage.creditsUsed, homepage.creditsUsed * 0.001, { origin });
  }

  return {
    score,
    checks,
    pagesAnalyzed: 1,
    issuesFound: issues.length,
    creditsUsed: homepage.creditsUsed,
    result: {
      domain: hostnameOf(origin),
      score,
      jsonLdBlocks: blocks.length,
      types: flatTypes,
      hasArticle,
      hasFaq,
      hasBreadcrumb,
      blocks: blocks.slice(0, 5),
      provider: homepage.provider,
    },
  };
}

// ---------------------------------------------------------------------------
// Content scan: homepage content quality for GEO
// ---------------------------------------------------------------------------

async function runContentScan(scan: Scan): Promise<ScanUpdate> {
  const input = scan.input || {};
  const origin = normalizeOrigin(String(input.domain || input.url || ""));

  const homepage = await scrapeUrl(origin, { onlyMainContent: true });
  if (!homepage.success || !homepage.data) {
    throw new Error(`Could not crawl ${origin}: ${homepage.error || "unknown crawler error"}`);
  }
  const page = homepage.data;

  const headings = (page.markdown.match(/^#{1,3}\s+.+$/gm) || []).map((h) => h.replace(/^#{1,3}\s+/, "").trim());
  const questionHeadings = headings.filter((h) => /\?|^(what|why|how|when|where|who|which|is|are|can|should)\b/i.test(h));
  const hasFaq = Boolean((page.metadata.jsonLd || []).length) && /faq/i.test(page.markdown);
  const listItems = (page.markdown.match(/^\s*[-*]\s+/gm) || []).length;
  const words = page.wordCount;

  const checks: Check[] = [];
  const issues: IssueSeed[] = [];

  makeCheck("Content depth", words >= 300 ? "pass" : words >= 150 ? "warn" : "fail", `${words} words of content`, checks, issues);
  makeCheck(
    "Question-form headings",
    questionHeadings.length >= 2 ? "pass" : questionHeadings.length === 1 ? "warn" : "fail",
    `${questionHeadings.length} question-form heading(s) of ${headings.length} headings`,
    checks,
    issues
  );
  makeCheck("FAQSection", hasFaq ? "pass" : "fail", hasFaq ? "FAQ content/schema detected" : "No FAQ section detected", checks, issues);
  makeCheck(
    "List formatting",
    listItems >= 3 ? "pass" : "warn",
    `${listItems} list items (bullet points improve extractability)`,
    checks,
    issues
  );

  const failed = checks.filter((c) => c.status === "fail").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  const score = Math.max(0, 100 - failed * 15 - warned * 5);

  if (issues.length > 0) {
    await db.insert(auditIssues).values(
      issues.map((issue) => ({
        workspaceId: scan.workspaceId,
        scanId: scan.id,
        category: issue.category,
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        fix: issue.fix,
        pagesAffected: 1,
        impact: issue.impact,
        effort: issue.effort,
        status: "open" as const,
      }))
    );
  }

  if (homepage.creditsUsed > 0) {
    await recordUsage(scan.workspaceId, homepage.provider, "content_scrape", homepage.creditsUsed, homepage.creditsUsed * 0.001, { origin });
  }

  return {
    score,
    checks,
    pagesAnalyzed: 1,
    issuesFound: issues.length,
    creditsUsed: homepage.creditsUsed,
    result: {
      domain: hostnameOf(origin),
      score,
      metrics: {
        words,
        headings: headings.length,
        questionHeadings: questionHeadings.length,
        listItems,
        hasFaq,
        links: page.links.length,
      },
      headings: headings.slice(0, 15),
      provider: homepage.provider,
    },
  };
}
