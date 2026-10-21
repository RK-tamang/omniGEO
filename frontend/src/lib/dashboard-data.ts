// Demo workspace data for the dashboard suite.
// Deterministic (seeded) so every load/build shows the same numbers.

export const workspace = {
  name: "Northwind Labs",
  domain: "northwindlabs.com",
  plan: "Pro Growth",
  member: "Aarav Mehta",
  role: "Head of Growth",
};

export const ENGINE_KEYS = ["chatgpt", "perplexity", "gemini", "aio"] as const;
export type EngineKey = (typeof ENGINE_KEYS)[number];

export const ENGINE_LABELS: Record<EngineKey, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  aio: "AI Overviews",
};

export const ENGINE_COLORS: Record<EngineKey, string> = {
  chatgpt: "#a78bfa",
  perplexity: "#22d3ee",
  gemini: "#34d399",
  aio: "#fbbf24",
};

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSeries(seed: number, start: number, end: number, jitter: number) {
  const rnd = mulberry32(seed);
  return Array.from({ length: 30 }, (_, i) => {
    const base = start + ((end - start) * i) / 29;
    return Math.max(1, Number((base + (rnd() - 0.5) * jitter).toFixed(1)));
  });
}

const END_DAY = Date.UTC(2026, 9, 18); // 18 Oct 2026
const dayLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export const days = Array.from({ length: 30 }, (_, i) =>
  dayLabel.format(new Date(END_DAY - (29 - i) * 86_400_000)),
);

export type Series = { name: string; color: string; data: number[] };

export const visibilitySeries: Series[] = [
  { name: "ChatGPT", color: ENGINE_COLORS.chatgpt, data: makeSeries(11, 26.5, 38.2, 4.5) },
  { name: "Perplexity", color: ENGINE_COLORS.perplexity, data: makeSeries(23, 18.0, 26.4, 3.5) },
  { name: "Gemini", color: ENGINE_COLORS.gemini, data: makeSeries(37, 12.5, 18.9, 3.0) },
  { name: "AI Overviews", color: ENGINE_COLORS.aio, data: makeSeries(53, 9.0, 14.6, 2.5) },
];

export const engineMentionRate: { key: EngineKey; value: number; change: number }[] = [
  { key: "chatgpt", value: 38.2, change: 5.4 },
  { key: "perplexity", value: 26.4, change: 3.1 },
  { key: "gemini", value: 18.9, change: 1.2 },
  { key: "aio", value: 14.6, change: -0.8 },
];

export const overviewKpis = [
  {
    label: "Mention rate",
    value: "34.8%",
    delta: 6.2,
    unit: "pts",
    hint: "Across 4 engines · 30 days",
    spark: visibilitySeries[0].data.slice(-14),
    color: ENGINE_COLORS.chatgpt,
  },
  {
    label: "Citation share",
    value: "21.4%",
    delta: 2.1,
    unit: "pts",
    hint: "Share of answers citing you",
    spark: makeSeries(42, 14.5, 22.0, 3.5),
    color: ENGINE_COLORS.perplexity,
  },
  {
    label: "Share of voice",
    value: "28.1%",
    delta: 1.4,
    unit: "pts",
    hint: "Among 4 tracked brands",
    spark: makeSeries(7, 24.0, 28.5, 2.5),
    color: ENGINE_COLORS.gemini,
  },
  {
    label: "Prompts tracked",
    value: "50",
    delta: 5,
    unit: "added",
    hint: "Weekly runs · 4 engines",
    spark: makeSeries(19, 40, 50, 2),
    color: ENGINE_COLORS.aio,
  },
];

export const shareOfVoice = [
  { name: "Northwind Labs (you)", value: 28.1, you: true },
  { name: "Competitor A", value: 31.6, you: false },
  { name: "Competitor B", value: 22.4, you: false },
  { name: "Competitor C", value: 11.2, you: false },
  { name: "Others", value: 6.7, you: false },
];

export type EngineStatus = "cited" | "mentioned" | "missing";
export type PromptRow = {
  prompt: string;
  type: "Category" | "Comparison" | "Problem" | "Brand";
  engines: Record<EngineKey, EngineStatus>;
  sentiment: "Positive" | "Neutral" | "Risk";
};

export const prompts: PromptRow[] = [
  {
    prompt: "best ai visibility tool for agencies",
    type: "Category",
    engines: { chatgpt: "cited", perplexity: "cited", gemini: "mentioned", aio: "missing" },
    sentiment: "Positive",
  },
  {
    prompt: "omnigeo vs competitor a",
    type: "Comparison",
    engines: { chatgpt: "cited", perplexity: "mentioned", gemini: "missing", aio: "missing" },
    sentiment: "Positive",
  },
  {
    prompt: "how do i track my brand in chatgpt",
    type: "Problem",
    engines: { chatgpt: "cited", perplexity: "cited", gemini: "cited", aio: "mentioned" },
    sentiment: "Positive",
  },
  {
    prompt: "alternatives to competitor b for seo teams",
    type: "Comparison",
    engines: { chatgpt: "mentioned", perplexity: "missing", gemini: "missing", aio: "missing" },
    sentiment: "Neutral",
  },
  {
    prompt: "what is generative engine optimization",
    type: "Category",
    engines: { chatgpt: "cited", perplexity: "mentioned", gemini: "mentioned", aio: "cited" },
    sentiment: "Positive",
  },
  {
    prompt: "is omnigeo worth it for a small team",
    type: "Brand",
    engines: { chatgpt: "mentioned", perplexity: "cited", gemini: "missing", aio: "missing" },
    sentiment: "Neutral",
  },
  {
    prompt: "best local seo tool for multi-location brands",
    type: "Category",
    engines: { chatgpt: "missing", perplexity: "missing", gemini: "mentioned", aio: "missing" },
    sentiment: "Risk",
  },
  {
    prompt: "how to check if ai crawlers can read my site",
    type: "Problem",
    engines: { chatgpt: "cited", perplexity: "cited", gemini: "mentioned", aio: "missing" },
    sentiment: "Positive",
  },
  {
    prompt: "omnigeo pricing and plans",
    type: "Brand",
    engines: { chatgpt: "cited", perplexity: "mentioned", gemini: "mentioned", aio: "missing" },
    sentiment: "Neutral",
  },
  {
    prompt: "seo tools for agencies in india",
    type: "Category",
    engines: { chatgpt: "mentioned", perplexity: "missing", gemini: "missing", aio: "missing" },
    sentiment: "Neutral",
  },
  {
    prompt: "omnigeo vs competitor c",
    type: "Comparison",
    engines: { chatgpt: "missing", perplexity: "missing", gemini: "missing", aio: "missing" },
    sentiment: "Risk",
  },
  {
    prompt: "how often should i check ai brand mentions",
    type: "Problem",
    engines: { chatgpt: "cited", perplexity: "cited", gemini: "missing", aio: "mentioned" },
    sentiment: "Positive",
  },
];

export type KeywordRow = {
  keyword: string;
  position: number;
  change: number;
  volume: number;
  features: string[];
  aiCited: boolean;
};

export const keywords: KeywordRow[] = [
  { keyword: "ai visibility tool", position: 3, change: 2, volume: 2400, features: ["AI Overview"], aiCited: true },
  { keyword: "generative engine optimization", position: 5, change: 4, volume: 1900, features: ["AI Overview", "Sitelinks"], aiCited: true },
  { keyword: "track brand in chatgpt", position: 6, change: 1, volume: 880, features: ["AI Overview"], aiCited: true },
  { keyword: "chatgpt seo tools", position: 8, change: -2, volume: 3600, features: ["AI Overview", "Video"], aiCited: true },
  { keyword: "ai overview tracker", position: 9, change: 3, volume: 1300, features: ["AI Overview"], aiCited: true },
  { keyword: "geo optimization software", position: 11, change: 5, volume: 720, features: [], aiCited: false },
  { keyword: "perplexity rank tracker", position: 12, change: -3, volume: 590, features: ["AI Overview"], aiCited: true },
  { keyword: "ai citation tracking", position: 14, change: 0, volume: 480, features: [], aiCited: false },
  { keyword: "local seo grid rank tracker", position: 17, change: 6, volume: 1100, features: ["Map pack"], aiCited: false },
  { keyword: "seo audit tool for agencies", position: 21, change: -4, volume: 2900, features: ["AI Overview"], aiCited: false },
  { keyword: "best geo software 2026", position: 24, change: 8, volume: 1600, features: ["AI Overview"], aiCited: false },
  { keyword: "ai seo audit tool", position: 28, change: -1, volume: 2200, features: [], aiCited: false },
  { keyword: "brand mentions in ai answers", position: 34, change: 11, volume: 390, features: [], aiCited: false },
  { keyword: "content score tool", position: 41, change: -6, volume: 880, features: [], aiCited: false },
];

export const rankDistribution = [
  { label: "1–3", count: 2 },
  { label: "4–10", count: 3 },
  { label: "11–20", count: 3 },
  { label: "21–50", count: 5 },
  { label: "50+", count: 1 },
];

export const audit = {
  score: 87,
  checks: 142,
  passed: 126,
  categories: [
    { name: "Performance", score: 94 },
    { name: "Crawlability", score: 91 },
    { name: "On-page", score: 86 },
    { name: "Schema & entities", score: 78 },
    { name: "AI readiness", score: 69 },
  ],
  issues: [
    {
      severity: "Critical" as const,
      title: "GPTBot blocked by robots.txt on /resources/*",
      pages: 12,
      detail:
        "A blanket User-agent rule from the March migration is still live. OpenAI's search crawler cannot retrieve these pages, which removes them from ChatGPT citations entirely.",
      fix: "Add a targeted rule for GPTBot/OAI-SearchBot above the wildcard block.",
    },
    {
      severity: "Critical" as const,
      title: "No Organization schema on the homepage",
      pages: 1,
      detail:
        "Answer engines rely on structured data to resolve your entity. Without Organization schema they infer it from surrounding copy — often incorrectly.",
      fix: "Add JSON-LD Organization with name, logo, sameAs and foundingDate.",
    },
    {
      severity: "Warning" as const,
      title: "Meta descriptions missing on comparison pages",
      pages: 6,
      detail: "Comparison pages are your highest-intent templates. Missing descriptions reduce retrieval confidence.",
      fix: "Write 140–160 character descriptions stating the claim and the source.",
    },
    {
      severity: "Warning" as const,
      title: "Author attribution missing on blog posts",
      pages: 9,
      detail: "Unattributed content scores lower on E-E-A-T signals and is cited less often in YMYL-adjacent topics.",
      fix: "Add author name, role and a link to an author page with Person schema.",
    },
    {
      severity: "Warning" as const,
      title: "FAQ answers exceed 400 words — hard to lift",
      pages: 4,
      detail: "Long, meandering answers are rarely quoted verbatim. Models prefer a crisp first paragraph.",
      fix: "Lead each answer with a 40–60 word direct answer, then elaborate.",
    },
    {
      severity: "Notice" as const,
      title: "Images missing alt text",
      pages: 23,
      detail: "Mostly decorative, but six product screenshots carry meaning without a description.",
      fix: "Add descriptive alt text to informative images.",
    },
    {
      severity: "Notice" as const,
      title: "Internal links to /pricing dropped below 5 per page",
      pages: 8,
      detail: "Thin internal linking weakens the path from informational pages to conversion pages.",
      fix: "Add 5+ contextual links per page, including one to /pricing.",
    },
  ],
};

/** Crawler-access findings only — the subset of the audit this tool is responsible for. */
export const crawlerWeaknesses = audit.issues.filter((i) =>
  /robots|crawler|GPTBot|OAI-SearchBot|PerplexityBot/i.test(`${i.title} ${i.detail} ${i.fix}`),
);

export type ContentItem = {
  title: string;
  status: "Published" | "In review" | "Draft";
  score: number;
  target: string;
  words: number;
  updated: string;
};

export const contentItems: ContentItem[] = [
  { title: "AI Overviews: what they change about click-through", status: "Published", score: 92, target: "ai overview tracker", words: 1480, updated: "2 days ago" },
  { title: "GEO, explained: how to become the answer AI gives", status: "Published", score: 89, target: "generative engine optimization", words: 1620, updated: "5 days ago" },
  { title: "OmniGEO vs Competitor A: an honest comparison", status: "In review", score: 84, target: "omnigeo vs competitor a", words: 1310, updated: "yesterday" },
  { title: "The source-first content method", status: "Published", score: 87, target: "ai citation tracking", words: 1150, updated: "1 week ago" },
  { title: "Local SEO when the answer is a map", status: "Published", score: 81, target: "local seo grid rank tracker", words: 1240, updated: "2 weeks ago" },
  { title: "Prompts are the new keywords", status: "Published", score: 86, target: "track brand in chatgpt", words: 1090, updated: "3 weeks ago" },
  { title: "Multi-location review management guide", status: "In review", score: 74, target: "local seo grid rank tracker", words: 1890, updated: "3 days ago" },
  { title: "Agency playbook: selling AI visibility retainers", status: "Draft", score: 61, target: "seo audit tool for agencies", words: 640, updated: "today" },
  { title: "How answer engines pick their sources", status: "Draft", score: 55, target: "ai citation tracking", words: 420, updated: "today" },
  { title: "Best AI visibility tools: 2026 buyer's guide", status: "Draft", score: 48, target: "best ai visibility tool for agencies", words: 310, updated: "2 days ago" },
];

export const contentKpis = [
  { label: "Avg content score", value: "78", delta: 4, unit: "pts", hint: "Across 10 tracked drafts" },
  { label: "Published (30d)", value: "4", delta: 1, unit: "posts", hint: "2 earning AI citations" },
  { label: "In review", value: "2", delta: 0, unit: "", hint: "Awaiting your approval" },
  { label: "Citation-ready", value: "6/10", delta: 2, unit: "", hint: "Score 80+ with sources" },
];

export const activity = [
  { time: "2h ago", tone: "win" as const, text: "Cited by ChatGPT for “best ai visibility tool for agencies”" },
  { time: "5h ago", tone: "info" as const, text: "Weekly prompt run completed — 50 prompts × 4 engines" },
  { time: "Yesterday", tone: "win" as const, text: "Entered the top 10 for “geo optimization software” (14 → 9)" },
  { time: "Yesterday", tone: "alert" as const, text: "Competitor C now cited for 3 prompts you were winning" },
  { time: "2 days ago", tone: "info" as const, text: "Audit re-run — health score 84 → 87" },
  { time: "3 days ago", tone: "win" as const, text: "Perplexity mention rate crossed 25%" },
];

export const opportunities = [
  { prompt: "omnigeo vs competitor c", gap: "Not cited in any engine", effort: "Medium", impact: "High" },
  { prompt: "best local seo tool for multi-location brands", gap: "Only Gemini mentions you", effort: "Medium", impact: "High" },
  { prompt: "seo tools for agencies in india", gap: "Mentioned, never cited", effort: "Low", impact: "Medium" },
  { prompt: "alternatives to competitor b for seo teams", gap: "Only ChatGPT mentions you", effort: "High", impact: "Medium" },
];

/* ---------------------------------- Keyword Research --------------------------------- */

export type KeywordIntent = "Informational" | "Commercial" | "Transactional" | "Local";

export type IdeaRow = {
  keyword: string;
  intent: KeywordIntent;
  volume: number;
  difficulty: number; // 0–100
  opportunity: number; // 0–100 — AI citation opportunity
  rank: number | null; // null = not ranking
  cluster: string;
};

export const keywordIdeas: IdeaRow[] = [
  { keyword: "ai visibility monitoring", intent: "Commercial", volume: 3200, difficulty: 54, opportunity: 92, rank: 6, cluster: "Core" },
  { keyword: "how to appear in chatgpt answers", intent: "Informational", volume: 5100, difficulty: 41, opportunity: 96, rank: 2, cluster: "GEO basics" },
  { keyword: "generative engine optimization guide", intent: "Informational", volume: 2600, difficulty: 37, opportunity: 89, rank: 4, cluster: "GEO basics" },
  { keyword: "best geo tools for agencies", intent: "Commercial", volume: 1800, difficulty: 62, opportunity: 88, rank: 11, cluster: "Buyer" },
  { keyword: "chatgpt brand mention tracker", intent: "Transactional", volume: 980, difficulty: 48, opportunity: 85, rank: 9, cluster: "Core" },
  { keyword: "does ai overviews cite my site", intent: "Informational", volume: 1400, difficulty: 29, opportunity: 81, rank: null, cluster: "GEO basics" },
  { keyword: "perplexity seo checklist", intent: "Informational", volume: 1100, difficulty: 33, opportunity: 84, rank: 14, cluster: "GEO basics" },
  { keyword: "geo software pricing india", intent: "Transactional", volume: 720, difficulty: 44, opportunity: 76, rank: null, cluster: "Buyer" },
  { keyword: "ai answer share of voice", intent: "Commercial", volume: 860, difficulty: 51, opportunity: 87, rank: 17, cluster: "Core" },
  { keyword: "optimize content for llm citations", intent: "Informational", volume: 1900, difficulty: 46, opportunity: 90, rank: 8, cluster: "Content" },
  { keyword: "local seo for ai search", intent: "Commercial", volume: 1200, difficulty: 57, opportunity: 79, rank: 22, cluster: "Local" },
  { keyword: "schema for ai answers", intent: "Informational", volume: 1600, difficulty: 39, opportunity: 86, rank: 5, cluster: "Content" },
  { keyword: "hire geo consultant", intent: "Transactional", volume: 440, difficulty: 66, opportunity: 58, rank: null, cluster: "Buyer" },
  { keyword: "ai crawler access checker free", intent: "Transactional", volume: 2100, difficulty: 31, opportunity: 94, rank: 3, cluster: "Tools" },
  { keyword: "gptbot robots.txt allow", intent: "Informational", volume: 2400, difficulty: 24, opportunity: 74, rank: 1, cluster: "Tools" },
  { keyword: "track brand across ai engines", intent: "Commercial", volume: 1500, difficulty: 58, opportunity: 91, rank: 19, cluster: "Core" },
];

export const intentColors: Record<KeywordIntent, string> = {
  Informational: "border-aqua/40 bg-aqua/10 text-aqua",
  Commercial: "border-iris/40 bg-iris/10 text-iris",
  Transactional: "border-mint/40 bg-mint/10 text-mint",
  Local: "border-gold/40 bg-gold/10 text-gold",
};

/* ------------------------------ Competitor Analysis ---------------------------------- */

export type CompetitorBrand = {
  name: string;
  you: boolean;
  sov: number;
  mentionRate: number;
  citationDomains: number;
  topPrompt: string;
  strength: string;
};

export const competitorBrands: CompetitorBrand[] = [
  {
    name: "Northwind Labs (you)",
    you: true,
    sov: 28.1,
    mentionRate: 34.8,
    citationDomains: 41,
    topPrompt: "how do i track my brand in chatgpt",
    strength: "Strong in problem-aware prompts",
  },
  {
    name: "Competitor A",
    you: false,
    sov: 31.6,
    mentionRate: 41.2,
    citationDomains: 87,
    topPrompt: "best ai visibility tool for agencies",
    strength: "Category pages + heavy PR citations",
  },
  {
    name: "Competitor B",
    you: false,
    sov: 22.4,
    mentionRate: 27.9,
    citationDomains: 63,
    topPrompt: "alternatives to competitor b for seo teams",
    strength: "Comparison and alternatives content",
  },
  {
    name: "Competitor C",
    you: false,
    sov: 11.2,
    mentionRate: 14.5,
    citationDomains: 29,
    topPrompt: "omnigeo vs competitor c",
    strength: "Developer docs get cited by Gemini",
  },
];

export type CompetitorPrompt = {
  prompt: string;
  statuses: ("wins" | "second" | "absent")[]; // you, A, B, C
};

export const competitorPrompts: CompetitorPrompt[] = [
  { prompt: "best ai visibility tool for agencies", statuses: ["second", "wins", "second", "absent"] },
  { prompt: "omnigeo vs competitor a", statuses: ["wins", "second", "absent", "absent"] },
  { prompt: "how do i track my brand in chatgpt", statuses: ["wins", "second", "second", "absent"] },
  { prompt: "alternatives to competitor b for seo teams", statuses: ["second", "wins", "second", "absent"] },
  { prompt: "what is generative engine optimization", statuses: ["wins", "second", "second", "second"] },
  { prompt: "seo tools for agencies in india", statuses: ["second", "wins", "absent", "absent"] },
  { prompt: "omnigeo vs competitor c", statuses: ["absent", "second", "second", "wins"] },
  { prompt: "ai overview tracking software", statuses: ["second", "wins", "second", "absent"] },
  { prompt: "affordable geo tools for startups", statuses: ["absent", "second", "wins", "second"] },
  { prompt: "how to get cited by perplexity", statuses: ["wins", "second", "absent", "second"] },
];

export const contentGaps = [
  {
    gap: "“Alternatives to …” pages",
    detail: "Competitor A owns 7 of 9 alternatives prompts. You have none.",
    impact: "High",
  },
  {
    gap: "Pricing transparency",
    detail: "Buyers ask about cost directly; engines answer with Competitor B's public pricing page.",
    impact: "High",
  },
  {
    gap: "India/region-specific lists",
    detail: "Both “agencies in india” prompts return Competitor A — no regional page of yours exists.",
    impact: "Medium",
  },
  {
    gap: "Developer-facing docs",
    detail: "Gemini repeatedly cites Competitor C's API docs for implementation questions.",
    impact: "Medium",
  },
];

/* ------------------------------------ Local SEO -------------------------------------- */

export type LocationRow = {
  name: string;
  city: string;
  rating: number;
  reviews: number;
  newReviews30d: number;
  completeness: number;
  localRank: number;
  status: "Healthy" | "At risk" | "Needs work";
};

export const locations: LocationRow[] = [
  { name: "Northwind Labs — Andheri", city: "Mumbai", rating: 4.6, reviews: 214, newReviews30d: 12, completeness: 94, localRank: 2, status: "Healthy" },
  { name: "Northwind Labs — Powai", city: "Mumbai", rating: 4.4, reviews: 156, newReviews30d: 7, completeness: 88, localRank: 4, status: "Healthy" },
  { name: "Northwind Labs — Koramangala", city: "Bengaluru", rating: 4.7, reviews: 302, newReviews30d: 21, completeness: 97, localRank: 1, status: "Healthy" },
  { name: "Northwind Labs — Hitec City", city: "Hyderabad", rating: 4.1, reviews: 89, newReviews30d: 3, completeness: 71, localRank: 8, status: "At risk" },
  { name: "Northwind Labs — Sector 62", city: "Noida", rating: 3.9, reviews: 47, newReviews30d: 1, completeness: 58, localRank: 13, status: "Needs work" },
];

// 7×7 grid-rank sample around the Andheri location (rank in local pack; 0 = not in top 10)
export const geogrid: number[] = [
  7, 6, 5, 4, 5, 6, 8,
  6, 4, 3, 2, 3, 5, 7,
  5, 3, 2, 1, 2, 4, 6,
  4, 2, 1, 1, 2, 3, 5,
  5, 3, 2, 1, 3, 4, 6,
  6, 5, 3, 2, 4, 6, 7,
  8, 7, 6, 5, 6, 8, 9,
];

export const reviewStats = {
  average: 4.4,
  total: 808,
  new30d: 44,
  responded: 0.87,
  distribution: [
    { stars: 5, count: 512 },
    { stars: 4, count: 196 },
    { stars: 3, count: 61 },
    { stars: 2, count: 24 },
    { stars: 1, count: 15 },
  ],
  asked: [
    "Does OmniGEO track AI Overviews too?",
    "Is there a free trial for agencies?",
    "Do you support multiple locations?",
  ],
};

/* --------------------------------- AI Crawler Check ---------------------------------- */

export type BotStatus = "allowed" | "blocked" | "limited";

export type CrawlerBot = {
  bot: string;
  owner: string;
  purpose: string;
  status: BotStatus;
  lastChecked: string;
};

export const crawlerBots: CrawlerBot[] = [
  { bot: "GPTBot", owner: "OpenAI", purpose: "Model training", status: "blocked", lastChecked: "4 min ago" },
  { bot: "OAI-SearchBot", owner: "OpenAI", purpose: "ChatGPT search results", status: "allowed", lastChecked: "4 min ago" },
  { bot: "PerplexityBot", owner: "Perplexity", purpose: "Perplexity answers", status: "allowed", lastChecked: "5 min ago" },
  { bot: "ClaudeBot", owner: "Anthropic", purpose: "Model training", status: "limited", lastChecked: "5 min ago" },
  { bot: "Google-Extended", owner: "Google", purpose: "Gemini grounding", status: "allowed", lastChecked: "6 min ago" },
  { bot: "Bingbot", owner: "Microsoft", purpose: "Bing + Copilot", status: "allowed", lastChecked: "6 min ago" },
];

export type CrawlSample = {
  path: string;
  title: string;
  code: number;
  indexable: boolean;
  engines: Record<string, BotStatus | "n/a">;
};

export const crawlSamples: CrawlSample[] = [
  { path: "/", title: "Home", code: 200, indexable: true, engines: { GPTBot: "blocked", "OAI-SearchBot": "allowed", PerplexityBot: "allowed", "Google-Extended": "allowed" } },
  { path: "/pricing", title: "Pricing", code: 200, indexable: true, engines: { GPTBot: "blocked", "OAI-SearchBot": "allowed", PerplexityBot: "allowed", "Google-Extended": "allowed" } },
  { path: "/resources/*", title: "Resource library", code: 200, indexable: true, engines: { GPTBot: "blocked", "OAI-SearchBot": "blocked", PerplexityBot: "blocked", "Google-Extended": "allowed" } },
  { path: "/blog/geo-explained", title: "GEO explained", code: 200, indexable: true, engines: { GPTBot: "blocked", "OAI-SearchBot": "allowed", PerplexityBot: "allowed", "Google-Extended": "allowed" } },
  { path: "/compare/vs-competitor-a", title: "Comparison", code: 200, indexable: true, engines: { GPTBot: "blocked", "OAI-SearchBot": "allowed", PerplexityBot: "limited", "Google-Extended": "allowed" } },
  { path: "/docs/api", title: "API docs", code: 200, indexable: false, engines: { GPTBot: "n/a", "OAI-SearchBot": "n/a", PerplexityBot: "n/a", "Google-Extended": "limited" } },
];

export const robotsSnippet = `User-agent: GPTBot
Disallow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: https://northwindlabs.com/sitemap.xml`;

export const crawlerKpis = [
  { label: "Engines that can read you", value: "4/6", delta: -1, unit: "bots", hint: "GPTBot blocked · ClaudeBot rate-limited", invert: false },
  { label: "Pages checked", value: "42", delta: 6, unit: "pages", hint: "Sampled in the last run", invert: false },
  { label: "Avg response time", value: "284ms", delta: -32, unit: "ms", hint: "faster vs last week", invert: true },
  { label: "Crawl errors", value: "3", delta: -2, unit: "issues", hint: "2 fixed · 1 new on /resources/*", invert: true },
];
