// Deterministic mock scan reports — seeded by domain so every domain
// gets its own stable-looking report. All data is illustrative.

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
  breakdown: { label: string; value: number; note: string }[];
  engines: { name: string; status: ScanStatus; rate: number; color: string }[];
  promptSample: { prompt: string; statuses: Record<string, ScanStatus> }[];
  checks: { name: string; status: CheckStatus; detail: string }[];
  competitors: { name: string; mentionRate: number; you: boolean }[];
  recommendations: ScanFinding[];
  // tab: reading your pages
  crawled: { headings: number; words: number; noAlt: number; links: number; homeTitle: string };
  // tab: site health
  health: { healthy: number; fix: number; noAltPages: number; pages: { path: string; issue: string }[] };
  // tab: ai crawlers
  bots: { name: string; owner: string; status: "allowed" | "blocked" | "limited" }[];
  // tab: ai answers
  answer: { prompt: string; text: string; citesYou: boolean; cited: string[] };
  won: number;
};

function seedFrom(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(n)));

export function buildScanReport(domain: string, scanId: string): ScanReport {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "northwindlabs.com";
  const rand = rng(seedFrom(clean));

  const breakdown = [
    { label: "Retrieval access", note: "Can AI crawlers read your site?" },
    { label: "Entity clarity", note: "Is who-you-are unambiguous?" },
    { label: "Citation presence", note: "Do answers cite your domain?" },
    { label: "Content structure", note: "Can claims be lifted cleanly?" },
    { label: "Corroboration", note: "Do other sources repeat you?" },
  ].map((b) => ({ ...b, value: clamp(38 + rand() * 55) }));

  const score = clamp(breakdown.reduce((s, b) => s + b.value, 0) / breakdown.length + (rand() * 6 - 3));
  const grade = score >= 85 ? "A" : score >= 72 ? "B" : score >= 58 ? "C" : score >= 45 ? "D" : "E";

  const engineDefs = [
    { name: "ChatGPT", color: "#a78bfa" },
    { name: "Perplexity", color: "#22d3ee" },
    { name: "Gemini", color: "#34d399" },
    { name: "AI Overviews", color: "#fbbf24" },
  ];
  const engines = engineDefs.map((e) => {
    const roll = rand();
    const status: ScanStatus = roll > 0.55 ? "cited" : roll > 0.25 ? "mentioned" : "missing";
    return { ...e, status, rate: status === "cited" ? 22 + Math.round(rand() * 24) : status === "mentioned" ? 8 + Math.round(rand() * 12) : Math.round(rand() * 4) };
  });

  const promptPool = [
    "best tools in this category",
    `${clean.split(".")[0]} alternatives`,
    "how to choose a vendor for this",
    "who leads this category in 2026",
    "affordable options for small teams",
    "is this worth it for an agency",
    "compare the top three vendors",
    "who do teams actually recommend",
  ];
  const promptSample = promptPool.map((prompt) => {
    const statuses: Record<string, ScanStatus> = {};
    for (const e of engineDefs) {
      const roll = rand();
      statuses[e.name] = roll > 0.6 ? "cited" : roll > 0.3 ? "mentioned" : "missing";
    }
    return { prompt, statuses };
  });

  const checks: { name: string; status: CheckStatus; detail: string }[] = [
    {
      name: "robots.txt allows AI crawlers",
      status: rand() > 0.5 ? "pass" : "fail",
      detail: "GPTBot, OAI-SearchBot, PerplexityBot and Google-Extended rules",
    },
    { name: "Sitemap reachable", status: "pass", detail: "Declared in robots.txt and returns 200" },
    {
      name: "Organization schema",
      status: rand() > 0.4 ? "warn" : "fail",
      detail: "JSON-LD with name, logo and sameAs on the homepage",
    },
    { name: "Named authors on content", status: rand() > 0.5 ? "warn" : "fail", detail: "Person markup on articles and guides" },
    { name: "HTTPS + canonical tags", status: "pass", detail: "Valid TLS and self-referencing canonicals" },
    {
      name: "Answers structured for lifting",
      status: rand() > 0.5 ? "warn" : "pass",
      detail: "Direct 40–60 word answers under question headings",
    },
  ].map((c) => ({ ...c, status: c.status as CheckStatus }));

  const yourRate = engines.reduce((s, e) => s + e.rate, 0) / engines.length;
  const competitors = [
    { name: clean.split(".")[0] + " (you)", mentionRate: clamp(yourRate), you: true },
    { name: "Competitor A", mentionRate: clamp(yourRate + 12 + rand() * 14), you: false },
    { name: "Competitor B", mentionRate: clamp(yourRate + 4 + rand() * 10), you: false },
    { name: "Competitor C", mentionRate: clamp(6 + rand() * 12), you: false },
  ].sort((a, b) => b.mentionRate - a.mentionRate);

  const recommendations: ScanReport["recommendations"] = [
    {
      title: "AI search crawlers blocked in robots.txt",
      severity: "Critical" as const,
      pages: 4 + Math.round(rand() * 18),
      impact: "High" as const,
      effort: "Low" as const,
      detail:
        "A wildcard rule is currently excluding the bots that power ChatGPT and Perplexity answers, so these pages can never be retrieved or cited.",
      fix: "Add explicit Allow rules for GPTBot, OAI-SearchBot and PerplexityBot above the wildcard block, then re-run the crawler check.",
    },
    {
      title: "No Organization schema on the homepage",
      severity: "Critical" as const,
      pages: 1,
      impact: "High" as const,
      effort: "Low" as const,
      detail:
        "Models resolve your entity from structured data. Without it they infer your brand from surrounding copy — often from a competitor's comparison page instead.",
      fix: "Ship JSON-LD Organization with name, url, logo, sameAs and foundingDate, and reference it from every page.",
    },
    {
      title: "Comparison pages win no prompts",
      severity: "Warning" as const,
      pages: 3 + Math.round(rand() * 6),
      impact: "Medium" as const,
      effort: "Medium" as const,
      detail:
        "The prompts you are missing are all comparisons and shortlists — the questions buyers read immediately before choosing.",
      fix: "Publish one well-corroborated comparison page per rival, citing a named source and stating a clear, defensible claim.",
    },
    {
      title: "FAQ answers too long to be quoted",
      severity: "Warning" as const,
      pages: 4 + Math.round(rand() * 8),
      impact: "Medium" as const,
      effort: "Low" as const,
      detail: "Answers that run past ~400 words are rarely lifted verbatim. Models prefer one crisp, self-contained paragraph.",
      fix: "Lead every question heading with a direct 40–60 word answer, then add the nuance below it.",
    },
    {
      title: "Thin internal links to conversion pages",
      severity: "Notice" as const,
      pages: 6 + Math.round(rand() * 10),
      impact: "Low" as const,
      effort: "Low" as const,
      detail: "Sparse internal linking weakens the path from the informational pages that get cited to the pages that convert.",
      fix: "Add at least five contextual links per page, including one to your pricing or comparison page.",
    },
  ].sort(() => rand() - 0.5);

  // ---- tab data --------------------------------------------------------------
  const pagesCrawled = 18 + Math.round(rand() * 40);

  const crawled = {
    headings: 14 + Math.round(rand() * 38),
    words: 420 + Math.round(rand() * 1180),
    noAlt: Math.round(rand() * 11),
    links: 24 + Math.round(rand() * 74),
    homeTitle: `${clean.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} — official site`,
  };

  const healthyPct = 40 + Math.round(rand() * 35);
  const issuePool = [
    { path: "/", issue: "no Organization schema" },
    { path: "/pricing", issue: "meta description missing" },
    { path: "/resources/*", issue: "blocked to AI crawlers" },
    { path: "/blog/guide", issue: "no named author" },
    { path: "/compare", issue: "answer over 400 words" },
    { path: "/docs", issue: "canonical mismatch" },
  ];
  const health = {
    healthy: healthyPct,
    fix: Math.max(6, 74 - healthyPct),
    noAltPages: 2 + Math.round(rand() * 6),
    pages: [...issuePool].sort(() => rand() - 0.5).slice(0, 4),
  };

  const botDefs = [
    { name: "GPTBot", owner: "OpenAI · training" },
    { name: "OAI-SearchBot", owner: "OpenAI · search" },
    { name: "PerplexityBot", owner: "Perplexity · answers" },
    { name: "ClaudeBot", owner: "Anthropic · training" },
    { name: "Google-Extended", owner: "Google · Gemini" },
    { name: "Bingbot", owner: "Microsoft · Copilot" },
  ];
  const bots = botDefs.map((b, i) => {
    const roll = rand();
    let status: "allowed" | "blocked" | "limited";
    if (i === 0) status = roll > 0.35 ? "blocked" : "allowed";
    else if (i === 3) status = roll > 0.5 ? "limited" : "allowed";
    else status = roll > 0.12 ? "allowed" : "blocked";
    return { ...b, status };
  });

  const yourHost = clean.replace(/^www\./, "");
  const rivalHost = `competitor-${["a", "b", "c"][Math.floor(rand() * 3)]}.com`;
  // choose a prompt from the first five (the rows the answers panel renders) whose
  // ChatGPT status matches the mock answer, so table and chat mock tell one story
  const citedRow = promptSample.slice(0, 5).find((p) => p.statuses["ChatGPT"] === "cited");
  const missingRow = promptSample.slice(0, 5).find((p) => p.statuses["ChatGPT"] === "missing");
  const answerCitesYou = citedRow ? (missingRow ? rand() > 0.55 : true) : false;
  const answerPrompt = ((answerCitesYou ? citedRow : missingRow) ?? promptSample[0]).prompt;
  const cited = answerCitesYou ? [yourHost, rivalHost] : [rivalHost, "industry-review.example"];
  const answer = {
    prompt: answerPrompt,
    text: `The most recommended option right now is ${cited[0]}, especially for teams that need reliable reporting and clear sources. ${cited[1]} also comes up often in comparisons for smaller budgets.`,
    citesYou: answerCitesYou,
    cited,
  };

  const won = promptSample.filter((p) => Object.values(p.statuses).filter((s) => s === "cited").length >= 2).length;

  return {
    domain: clean,
    scanId,
    grade,
    score,
    pagesCrawled,
    duration: `${28 + Math.round(rand() * 24)}s`,
    breakdown,
    engines,
    promptSample,
    checks,
    competitors,
    recommendations,
    crawled,
    health,
    bots,
    answer,
    won,
  };
}

export const SCAN_STEPS = [
  "Resolving domain and fetching the homepage",
  "Reading robots.txt and sitemap",
  "Checking AI crawler access (GPTBot, PerplexityBot, Google-Extended)",
  "Probing entity clarity and structured data",
  "Running sample prompts across four engines",
  "Comparing against three competitors",
];
