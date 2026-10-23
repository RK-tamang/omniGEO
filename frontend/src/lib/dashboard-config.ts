// Product configuration for the dashboard suite: the answer engines we track,
// the reference list of AI crawlers, and the shared row types.
//
// This module holds configuration only — no rows. Every figure the dashboard
// renders comes from the workspace's own tracked data, read through
// `@/lib/workspace-data`.

export const ENGINE_KEYS = ["chatgpt", "perplexity", "gemini", "aio"] as const;
export type EngineKey = (typeof ENGINE_KEYS)[number];

export const ENGINE_LABELS: Record<EngineKey, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  aio: "AI Overviews",
};

export const ENGINE_COLORS: Record<EngineKey, string> = {
  chatgpt: "#8a93c8",
  perplexity: "#39a0a8",
  gemini: "#5fb98a",
  aio: "#d9a441",
};

export type EngineStatus = "cited" | "mentioned" | "missing";

export type PromptRow = {
  prompt: string;
  type: "Category" | "Comparison" | "Problem" | "Brand" | "Question" | "How-to";
  engines: Record<EngineKey, EngineStatus>;
  sentiment: "Positive" | "Neutral" | "Risk";
};

export type ContentItem = {
  title: string;
  status: "Published" | "In review" | "Draft";
  score: number;
  target: string;
  words: number;
  updated: string;
};

export type KeywordRow = {
  keyword: string;
  position: number;
  change: number;
  volume: number;
  features: string[];
  aiCited: boolean;
};

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

export const intentColors: Record<KeywordIntent, string> = {
  Informational: "border-aqua/40 bg-aqua/10 text-aqua",
  Commercial: "border-iris/40 bg-iris/10 text-iris",
  Transactional: "border-mint/40 bg-mint/10 text-mint",
  Local: "border-gold/40 bg-gold/10 text-gold",
};

export type CompetitorBrand = {
  name: string;
  you: boolean;
  sov: number;
  mentionRate: number;
  citationDomains: number;
  topPrompt: string;
  strength: string;
};

export type CompetitorPrompt = {
  prompt: string;
  statuses: ("wins" | "second" | "absent")[];
};

export type BotStatus = "allowed" | "blocked" | "limited";

export type CrawlerBot = {
  bot: string;
  owner: string;
  purpose: string;
  status: BotStatus;
  /** The robots.txt rule that produced the verdict, when there is one. */
  rule?: string | null;
  lastChecked: string;
};

/**
 * The answer-engine crawlers we check for. This is a reference list — who runs
 * the bot and what it is for — not a record of any site's access. The status
 * per bot comes from the live robots.txt check.
 */
export const KNOWN_AI_BOTS: { bot: string; owner: string; purpose: string }[] = [
  { bot: "GPTBot", owner: "OpenAI", purpose: "Model training" },
  { bot: "OAI-SearchBot", owner: "OpenAI", purpose: "ChatGPT search results" },
  { bot: "PerplexityBot", owner: "Perplexity", purpose: "Perplexity answers" },
  { bot: "ClaudeBot", owner: "Anthropic", purpose: "Model training" },
  { bot: "Google-Extended", owner: "Google", purpose: "Gemini grounding" },
  { bot: "Bingbot", owner: "Microsoft", purpose: "Bing + Copilot" },
];

export type CrawlSample = {
  path: string;
  title: string;
  code: number;
  indexable: boolean;
  engines: Record<string, BotStatus | "n/a">;
};

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

export type Series = { name: string; color: string; data: number[] };
