// Scan report shapes.
//
// A report is assembled from what the scan engine actually recorded: the
// audit scan's checks and issues, the visibility scan's engine results, the
// crawler's page summaries and the live robots.txt verdict. Nothing here is
// generated — the helpers below only reshape real rows.

export type ScanStatus = "cited" | "mentioned" | "missing";
export type CheckStatus = "pass" | "warn" | "fail";
export type ScanSeverity = "Critical" | "Warning" | "Notice";

export type ScanFinding = {
  /** the weakness, stated as the problem */
  title: string;
  severity: ScanSeverity;
  /** how many pages the weakness affects */
  pages: number;
  impact: "High" | "Medium" | "Low";
  effort: "Low" | "Medium" | "High";
  /** why it costs you AI visibility */
  detail: string;
  /** the concrete remedy, shown as "How to fix" */
  fix: string;
};

export type ScanReport = {
  domain: string;
  scanId: string;
  grade: string;
  score: number;
  pagesCrawled: number;
  duration: string;
  ranAt: string | null;
  simulated: boolean;
  breakdown: { label: string; value: number; note: string }[];
  engines: { name: string; status: ScanStatus; rate: number; color: string }[];
  promptSample: { prompt: string; statuses: Record<string, ScanStatus> }[];
  checks: { name: string; status: CheckStatus; detail: string }[];
  competitors: { name: string; mentionRate: number; you: boolean }[];
  recommendations: ScanFinding[];
  /** The audit engine's own written summary of the site. */
  summary: string | null;
  /** robots.txt / sitemap.xml / llms.txt reachability. */
  resources: { label: string; ok: boolean; detail: string }[];
  // tab: reading your pages
  crawled: { words: number; title: string };
  pages: { path: string; title: string; status: string; words: number; links: number }[];
  // tab: site health
  health: { healthy: number; fix: number; noAltPages: number; pages: { path: string; issue: string }[] };
  // tab: ai crawlers
  bots: { name: string; owner: string; status: "allowed" | "blocked" | "limited" }[];
  // tab: ai answers
  answer: { prompt: string; text: string; citesYou: boolean; cited: string[] };
  won: number;
};

/* ------------------------------ engine payloads ----------------------------- */

export type BackendScan = {
  id: string;
  type: string;
  status: string;
  score?: number | null;
  input?: Record<string, any> | null;
  result?: Record<string, any> | null;
  checks?: Array<{ name: string; status: string; details: string }> | null;
  pagesAnalyzed?: number | null;
  issuesFound?: number | null;
  startedAt?: string | number | null;
  completedAt?: string | number | null;
  createdAt?: string | number | null;
};

export type BackendIssue = {
  severity: string;
  title: string;
  description: string;
  fix: string;
  pagesAffected?: number | null;
  impact?: string | null;
  effort?: string | null;
};

export type BackendPrompt = {
  prompt: string;
  engines?: Record<string, string> | null;
};

export type BotVerdict = {
  bot: string;
  owner: string;
  purpose?: string;
  status: "allowed" | "blocked" | "limited";
  rule?: string | null;
};

const ENGINE_NAMES: Record<string, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  aio: "AI Overviews",
};

const ENGINE_COLORS: Record<string, string> = {
  chatgpt: "#8a93c8",
  perplexity: "#39a0a8",
  gemini: "#5fb98a",
  aio: "#d9a441",
};

const ENGINE_ORDER = ["chatgpt", "perplexity", "gemini", "aio"];

/** Audit checks the engine runs, grouped into the categories we report on. */
const CHECK_CATEGORIES: { category: string; names: string[] }[] = [
  { category: "Infrastructure", names: ["HTTPS", "robots.txt", "sitemap.xml", "llms.txt"] },
  {
    category: "On-page",
    names: [
      "Title tag",
      "Meta description",
      "H1 heading",
      "Canonical",
      "Open Graph tags",
      "HTML lang attribute",
      "Content depth",
    ],
  },
  { category: "Structured data", names: ["Structured data (JSON-LD)"] },
  { category: "AI readiness", names: ["Question-form headings", "List formatting"] },
];

function toMillis(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function grade(score: number): string {
  return score >= 85 ? "A" : score >= 72 ? "B" : score >= 58 ? "C" : score >= 45 ? "D" : "E";
}

function toStatus(value: unknown): ScanStatus {
  return value === "cited" || value === "mentioned" ? value : "missing";
}

/**
 * Assemble a report from the rows the engine recorded.
 *
 * `scans` are the workspace's scans for this run — the audit scan drives the
 * health panel, the visibility scan drives the answers panel, and the crawler
 * scan supplies the page sample.
 */
export function buildScanReport(input: {
  domain: string;
  scanId: string;
  scans: BackendScan[];
  issues: BackendIssue[];
  prompts: BackendPrompt[];
  bots: BotVerdict[];
}): ScanReport {
  const { domain, scanId, scans, issues, prompts, bots } = input;

  const audit = scans.find((s) => s.type === "audit" && s.status === "completed");
  const visibility = scans.find((s) => s.type === "visibility" && s.status === "completed");
  const crawler = scans.find((s) => s.type === "crawler" && s.status === "completed");

  const checks = (audit?.checks ?? []).map((c) => ({
    name: c.name,
    status: (c.status === "pass" || c.status === "warn" || c.status === "fail" ? c.status : "warn") as CheckStatus,
    detail: c.details ?? "",
  }));

  const breakdown = CHECK_CATEGORIES.map(({ category, names }) => {
    const group = checks.filter((c) => names.includes(c.name));
    const passed = group.filter((c) => c.status === "pass").length;
    return {
      label: category,
      value: group.length ? Math.round((passed / group.length) * 100) : 0,
      note: group.length ? `${passed} of ${group.length} checks passed` : "not covered by this audit",
    };
  }).filter((b) => b.note !== "not covered by this audit");

  const recommendations: ScanFinding[] = issues.map((i) => ({
    title: i.title,
    severity: (i.severity === "Critical" || i.severity === "Warning" ? i.severity : "Notice") as ScanSeverity,
    pages: i.pagesAffected ?? 0,
    impact: (i.impact === "High" || i.impact === "Medium" || i.impact === "Low" ? i.impact : "Medium") as ScanFinding["impact"],
    effort: (i.effort === "Low" || i.effort === "Medium" || i.effort === "High" ? i.effort : "Medium") as ScanFinding["effort"],
    detail: i.description,
    fix: i.fix,
  }));

  const engineRows = ((visibility?.result?.engines ?? []) as Array<{
    engine?: string;
    score?: number;
    cited?: number;
    mentioned?: number;
    missing?: number;
    topCitations?: string[];
  }>).filter((e) => typeof e?.engine === "string");

  const engines = ENGINE_ORDER.filter((key) => engineRows.some((e) => e.engine === key)).map((key) => {
    const row = engineRows.find((e) => e.engine === key)!;
    const status: ScanStatus =
      (row.cited ?? 0) > 0 ? "cited" : (row.mentioned ?? 0) > 0 ? "mentioned" : "missing";
    return {
      name: ENGINE_NAMES[key] ?? key,
      status,
      rate: row.score ?? 0,
      color: ENGINE_COLORS[key] ?? "#8a93c8",
    };
  });

  const promptSample = prompts
    .filter((p) => p.engines && Object.keys(p.engines).length > 0)
    .slice(0, 8)
    .map((p) => ({
      prompt: p.prompt,
      statuses: Object.fromEntries(
        ENGINE_ORDER.map((key) => [ENGINE_NAMES[key] ?? key, toStatus(p.engines?.[key])]),
      ) as Record<string, ScanStatus>,
    }));

  const won = promptSample.filter((p) => Object.values(p.statuses).filter((s) => s === "cited").length >= 2).length;

  // The domains the engines cited — the real competitive set for this scan.
  const citedDomains = new Map<string, number>();
  for (const engine of engineRows) {
    for (const url of engine.topCitations ?? []) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        if (host) citedDomains.set(host, (citedDomains.get(host) ?? 0) + 1);
      } catch {
        // Ignore URLs the provider reported in an unparseable form.
      }
    }
  }
  const totalCitations = [...citedDomains.values()].reduce((a, b) => a + b, 0);
  const competitors = [...citedDomains.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({
      name,
      mentionRate: totalCitations ? Math.round((count / totalCitations) * 100) : 0,
      you: false,
    }));

  const metrics = (audit?.result?.metrics ?? {}) as {
    words?: number;
    headings?: number;
    links?: number;
  };
  const crawlSummaries = ((crawler?.result?.crawls ?? []) as Array<{
    url?: string;
    success?: boolean;
    title?: string;
    wordCount?: number;
    linkCount?: number;
    error?: string;
  }>).filter(Boolean);

  // The audit scan records the pages it read; the crawler scan records the
  // same pages with their link counts. Merge both into one sample.
  const auditPages = ((audit?.result?.pages ?? []) as Array<{
    url?: string;
    title?: string;
    wordCount?: number;
  }>).filter(Boolean);

  const pages = auditPages.map((p) => {
    let path = p.url ?? "";
    try {
      const u = new URL(path);
      path = u.pathname + u.search;
    } catch {
      // Keep the raw URL when it cannot be parsed.
    }
    const crawled = crawlSummaries.find((c) => c.url === p.url);
    return {
      path,
      title: p.title ?? crawled?.title ?? "",
      status: crawled ? (crawled.success ? "200" : "failed") : "read",
      words: p.wordCount ?? crawled?.wordCount ?? 0,
      links: crawled?.linkCount ?? 0,
    };
  });

  const homeTitle =
    pages.find((p) => p.path === "/")?.title ||
    pages[0]?.title ||
    ((audit?.result?.headings ?? []) as string[])[0] ||
    domain;

  const totalWords = pages.reduce((s, p) => s + p.words, 0);

  const crawled = {
    words: totalWords || metrics.words || 0,
    title: homeTitle,
  };

  const resources = [
    { key: "robots", label: "robots.txt" },
    { key: "sitemap", label: "sitemap.xml" },
    { key: "llmsTxt", label: "llms.txt" },
  ].map((r) => {
    const entry = (audit?.result?.resources ?? {}) as Record<string, { ok?: boolean; status?: number }>;
    const value = entry[r.key];
    return {
      label: r.label,
      ok: Boolean(value?.ok),
      detail: value?.ok ? "reachable" : value?.status ? `HTTP ${value.status}` : "not found",
    };
  });

  const passCount = checks.filter((c) => c.status === "pass").length;
  const health = {
    healthy: checks.length ? Math.round((passCount / checks.length) * 100) : 0,
    fix: checks.length ? 100 - Math.round((passCount / checks.length) * 100) : 0,
    noAltPages: 0,
    pages: recommendations.slice(0, 4).map((r) => ({ path: r.title, issue: r.severity })),
  };

  const score =
    typeof visibility?.score === "number"
      ? visibility.score
      : typeof audit?.score === "number"
        ? audit.score
        : 0;

  const started = toMillis(visibility?.startedAt ?? audit?.startedAt ?? visibility?.createdAt);
  const completed = toMillis(visibility?.completedAt ?? audit?.completedAt ?? visibility?.createdAt);
  const duration =
    started !== null && completed !== null && completed >= started
      ? `${Math.max(1, Math.round((completed - started) / 1000))}s`
      : "—";

  const topCitations = engineRows.flatMap((e) => e.topCitations ?? []);
  const answer = {
    prompt: promptSample[0]?.prompt ?? "",
    text:
      visibility?.result?.promptsTested
        ? `${visibility.result.promptsTested} prompts were run against ${engineRows.length} engines during this scan.`
        : "",
    citesYou: topCitations.some((u) => u.includes(domain)),
    cited: [...new Set(topCitations)].slice(0, 8).map((u) => {
      try {
        return new URL(u).hostname.replace(/^www\./, "");
      } catch {
        return u;
      }
    }),
  };

  return {
    domain,
    scanId,
    grade: grade(score),
    score,
    pagesCrawled: audit?.pagesAnalyzed ?? pages.length,
    duration,
    ranAt: completed !== null ? new Date(completed).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : null,
    simulated: Boolean(visibility?.result?.simulated) || Boolean(audit?.result?.summarySimulated),
    breakdown,
    engines,
    promptSample,
    checks,
    competitors,
    recommendations,
    summary: typeof audit?.result?.summary === "string" ? audit.result.summary : null,
    resources,
    crawled,
    pages,
    health,
    bots: bots.map((b) => ({ name: b.bot, owner: b.owner, status: b.status })),
    answer,
    won,
  };
}

export const SCAN_STEPS = [
  "Resolving domain and fetching the homepage",
  "Reading robots.txt, sitemap and llms.txt",
  "Checking on-page structure and structured data",
  "Running sample prompts across four engines",
  "Recording citations and share of voice",
];
