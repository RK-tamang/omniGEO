/**
 * DataForSEO API client for the OmniGEO scan engine.
 *   LLM API   (/v3/serp/llm/live)          - prompt -> engine answer + citations
 *   Labs API  (/v3/dataforseo_labs/...)    - keyword ideas
 *   SERP API  (/v3/serp/google/maps/live)  - local map pack rankings
 *
 * With the placeholder demo credentials in .env the client returns deterministic
 * simulated payloads flagged with `simulated: true`, so scans/dashboard flows
 * stay functional until real credentials are configured.
 */

import { isLiveCredential } from "./llm.js";

const USD_TO_NPR = 132;

interface DataForSEOTask {
  result?: any;
  status_message?: string;
}

interface DataForSEOResponse {
  status_code?: number;
  status_message?: string;
  tasks?: DataForSEOTask[];
  tasks_count?: number;
  credits?: number;
}

export interface EngineCitation {
  url: string;
  domain: string;
  title: string;
  position: number;
}

export interface LLMMentionResult {
  success: boolean;
  answer?: string;
  citations: EngineCitation[];
  model: string;
  creditsUsed: number;
  simulated: boolean;
  costUsd: number;
  error?: string;
}

export interface KeywordIdea {
  keyword: string;
  searchVolume: number;
  competition: number;
  cpc: number;
}

export interface KeywordIdeasResult {
  success: boolean;
  keywords: KeywordIdea[];
  creditsUsed: number;
  simulated: boolean;
  costUsd: number;
  error?: string;
}

export interface MapsRankItem {
  position: number;
  title: string;
  address: string;
  rating?: number;
  reviews?: number;
}

export interface MapsResult {
  success: boolean;
  items: MapsRankItem[];
  gridPoints: number;
  creditsUsed: number;
  simulated: boolean;
  costUsd: number;
  error?: string;
}

function isLive(): boolean {
  return isLiveCredential(process.env.DATAFORSEO_LOGIN) && isLiveCredential(process.env.DATAFORSEO_PASSWORD);
}

function basicAuthHeader(): string {
  return "Basic " + Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString("base64");
}

async function dfsRequest(endpoint: string, body: object): Promise<{ ok: boolean; data?: DataForSEOResponse; error?: string }> {
  const baseUrl = (process.env.DATAFORSEO_BASE_URL || "https://api.dataforseo.com").replace(/\/$/, "");
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const data = (await response.json().catch(() => ({}))) as DataForSEOResponse;
    if (!response.ok || (data.status_code !== undefined && data.status_code !== 20000)) {
      return { ok: false, error: data.status_message || `DataForSEO error ${response.status}` };
    }
    return { ok: true, data };
  } catch (error: any) {
    return { ok: false, error: error?.message || "network error" };
  }
}

/** Stable 32-bit hash so simulated results are deterministic per input. */
function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const CITATION_POOL = [
  { domain: "en.wikipedia.org", title: "Wikipedia article" },
  { domain: "github.com", title: "GitHub repository" },
  { domain: "reddit.com", title: "Reddit discussion thread" },
  { domain: "g2.com", title: "G2 product reviews" },
  { domain: "producthunt.com", title: "Product Hunt launch page" },
  { domain: "forbes.com", title: "Forbes industry analysis" },
  { domain: "techcrunch.com", title: "TechCrunch coverage" },
  { domain: "medium.com", title: "Medium explainer article" },
];

/**
 * Ask an answer engine about a prompt and get back its answer + cited sources.
 * Live: DataForSEO LLM API. Simulated: deterministic answer from a citation pool.
 */
export async function getLLMMentions(request: {
  prompt: string;
  model?: string;
  location_code?: number;
  language_code?: string;
}): Promise<LLMMentionResult> {
  const model = request.model || "chatgpt";

  if (!isLive()) {
    const h = hashString(`${model}:${request.prompt}`);
    const citationCount = 3 + (h % 3);
    const citations: EngineCitation[] = Array.from({ length: citationCount }, (_, i) => {
      const pick = CITATION_POOL[(h + i * 3) % CITATION_POOL.length];
      return {
        url: `https://${pick.domain}/`,
        domain: pick.domain,
        title: pick.title,
        position: i + 1,
      };
    });
    const answer = `"${request.prompt.trim().slice(0, 140)}" - according to ${citations
      .map((c) => c.domain)
      .join(", ")}. (Simulated engine response - configure live DataForSEO credentials for real LLM SERP data.)`;

    return {
      success: true,
      answer,
      citations,
      model,
      creditsUsed: 1,
      simulated: true,
      costUsd: 0,
    };
  }

  const res = await dfsRequest("/v3/serp/llm/live", {
    prompt: request.prompt,
    model,
    location_code: request.location_code ?? 2840,
    language_code: request.language_code ?? "en",
  });

  if (!res.ok || !res.data) {
    return {
      success: false,
      citations: [],
      model,
      creditsUsed: 0,
      simulated: false,
      costUsd: 0,
      error: res.error || "DataForSEO LLM request failed",
    };
  }

  // Lenient parse: DataForSEO result shapes vary slightly by engine.
  const result = res.data.tasks?.[0]?.result?.[0] ?? {};
  const answer: string = result.answer || result.text || result.description || "";
  const rawItems: any[] = result.items || result.citations || result.references || [];
  const citations: EngineCitation[] = rawItems
    .map((item, index) => ({
      url: item.url || item.link || "",
      domain: item.domain || (item.url ? safeDomain(item.url) : ""),
      title: item.title || item.source || "",
      position: item.position || item.rank_group || index + 1,
    }))
    .filter((c) => c.url);

  return {
    success: true,
    answer,
    citations,
    model,
    creditsUsed: 1,
    simulated: false,
    costUsd: 0.01,
  };
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.split("/")[0] || "";
  }
}

/** Expand keywords into GEO prompt ideas. Live: DataForSEO Labs. Simulated: deterministic variants. */
export async function getKeywordIdeas(request: {
  keywords: string[];
  location_code?: number;
  language_code?: string;
  include_serp_info?: boolean;
}): Promise<KeywordIdeasResult> {
  if (!isLive()) {
    const suffixes = ["", " alternatives", " pricing", " best tools", " vs competitors", " reviews", " for startups"];
    const keywords: KeywordIdea[] = [];
    for (const seed of request.keywords.slice(0, 10)) {
      for (const suffix of suffixes) {
        const h = hashString(`${seed}${suffix}`);
        keywords.push({
          keyword: `${seed}${suffix}`,
          searchVolume: 100 + (h % 4800),
          competition: Math.round(((h % 100) / 100) * 100) / 100,
          cpc: Math.round((0.5 + (h % 800) / 100) * 100) / 100,
        });
      }
    }
    return { success: true, keywords, creditsUsed: 1, simulated: true, costUsd: 0 };
  }

  const res = await dfsRequest("/v3/dataforseo_labs/google/keyword_ideas/live", {
    keywords: request.keywords,
    location_code: request.location_code ?? 2840,
    language_code: request.language_code ?? "en",
    include_serp_info: request.include_serp_info ?? false,
  });

  if (!res.ok || !res.data) {
    return {
      success: false,
      keywords: [],
      creditsUsed: 0,
      simulated: false,
      costUsd: 0,
      error: res.error || "DataForSEO keyword ideas request failed",
    };
  }

  const items = res.data.tasks?.[0]?.result?.[0]?.items ?? res.data.tasks?.[0]?.result ?? [];
  const keywords: KeywordIdea[] = (Array.isArray(items) ? items : []).map((item: any) => ({
    keyword: item.keyword || "",
    searchVolume: item.search_volume || 0,
    competition: item.competition ?? 0,
    cpc: item.cpc ?? 0,
  }));

  return { success: true, keywords, creditsUsed: 1, simulated: false, costUsd: 0.01 };
}

/** Local map-pack rankings. Live: DataForSEO SERP Maps. Simulated: deterministic grid. */
export async function getMapsRankings(request: {
  keyword: string;
  location_code?: number;
  language_code?: string;
  depth?: number;
  grid_size?: "5x5" | "7x7";
}): Promise<MapsResult> {
  const gridPoints = request.grid_size === "7x7" ? 49 : 25;

  if (!isLive()) {
    const h = hashString(`${request.keyword}:${request.location_code ?? 2840}`);
    const depth = Math.min(request.depth ?? 10, 20);
    const items: MapsRankItem[] = Array.from({ length: depth }, (_, i) => ({
      position: i + 1,
      title: `${request.keyword} provider ${i + 1}`,
      address: ["Kathmandu", "Pokhara", "Lalitpur", "Bhaktapur", "Chitwan"][i % 5],
      rating: Math.round((3.5 + ((h + i * 7) % 15) / 10) * 10) / 10,
      reviews: 20 + ((h + i * 13) % 480),
    }));
    return { success: true, items, gridPoints, creditsUsed: gridPoints, simulated: true, costUsd: 0 };
  }

  const res = await dfsRequest("/v3/serp/google/maps/live", {
    keyword: request.keyword,
    location_code: request.location_code ?? 2840,
    language_code: request.language_code ?? "en",
    depth: request.depth ?? 10,
  });

  if (!res.ok || !res.data) {
    return {
      success: false,
      items: [],
      gridPoints,
      creditsUsed: 0,
      simulated: false,
      costUsd: 0,
      error: res.error || "DataForSEO maps request failed",
    };
  }

  const items: MapsRankItem[] = [];
  const results = res.data.tasks?.[0]?.result ?? [];
  for (const taskResult of Array.isArray(results) ? results : [results]) {
    for (const item of taskResult?.items ?? []) {
      items.push({
        position: item.rank_absolute || items.length + 1,
        title: item.title || "",
        address: item.address || item.snippet || "",
        rating: item.rating?.value,
        reviews: item.rating?.votes_count,
      });
    }
  }

  return { success: true, items, gridPoints, creditsUsed: gridPoints, simulated: false, costUsd: gridPoints * 0.002 };
}

/** Record a DataForSEO operation's cost in USD for billing tables. */
export function dfsCostUsd(quantity: number, simulated: boolean): number {
  return simulated ? 0 : Math.round(quantity * 0.01 * USD_TO_NPR * 100) / 100 / USD_TO_NPR;
}
