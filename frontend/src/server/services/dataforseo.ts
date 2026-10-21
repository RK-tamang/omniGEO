/**
 * DataForSEO API client
 * Handles: Prompt Discovery (Keyword Ideas), Rank Tracking (Maps API), LLM Mentions (LLM API)
 */
export interface DataForSEOConfig {
  login: string;
  password: string;
  baseUrl: string;
}

export interface KeywordIdeaRequest {
  keywords: string[];
  location_code?: number;
  language_code?: string;
  include_serp_info?: boolean;
}

export interface KeywordIdeaResponse {
  tasks: Array<{
    result: Array<{
      keyword: string;
      search_volume: number;
      competition: number;
      cpc: number;
      serp_info?: Record<string, unknown>;
    }>;
  }>;
}

export interface MapsAPIRequest {
  keyword: string;
  location_code: number;
  language_code: string;
  depth?: number;
  grid_size?: "5x5" | "7x7";
}

export interface MapsAPIResponse {
  tasks: Array<{
    result: Array<{
      items: Array<{
        rank_group: number;
        rank_absolute: number;
        position: string;
        xpath: string;
        title: string;
        domain: string;
        url: string;
        latitude: number;
        longitude: number;
      }>;
    }>;
  }>;
}

export interface LLMAPIRequest {
  prompt: string;
  model: "chatgpt" | "perplexity" | "gemini" | "aio";
  location_code?: number;
  language_code?: string;
}

export interface LLMAPIResponse {
  tasks: Array<{
    result: Array<{
      answer: string;
      citations: Array<{
        domain: string;
        url: string;
        title: string;
      }>;
      model: string;
    }>;
  }>;
}

export class DataForSEOClient {
  private config: DataForSEOConfig;
  private authHeader: string;

  constructor(config: DataForSEOConfig) {
    this.config = config;
    this.authHeader = "Basic " + Buffer.from(`${config.login}:${config.password}`).toString("base64");
  }

  private async request<T>(endpoint: string, body: object): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([body]),
    });

    if (!response.ok) {
      throw new Error(`DataForSEO API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Prompt Discovery - Keyword Ideas API
   * Cost: $0.01 / research run
   */
  async getKeywordIdeas(request: KeywordIdeaRequest): Promise<KeywordIdeaResponse> {
    return this.request("/v3/dataforseo_labs/google/keyword_ideas/live", request);
  }

  /**
   * Rank Tracking - Maps API (Geo-Grid SERP)
   * Cost: $0.0006 / SERP request
   */
  async getMapsRankings(request: MapsAPIRequest): Promise<MapsAPIResponse> {
    return this.request("/v3/serp/google/maps/live", request);
  }

  /**
   * LLM Mentions - LLM API
   * Cost: $0.101 / live query call
   */
  async getLLMentions(request: LLMAPIRequest): Promise<LLMAPIResponse> {
    return this.request("/v3/serp/llm/live", request);
  }
}

let dataforseoClient: DataForSEOClient | null = null;

export function getDataForSEOClient(): DataForSEOClient {
  if (!dataforseoClient) {
    dataforseoClient = new DataForSEOClient({
      login: process.env.DATAFORSEO_LOGIN!,
      password: process.env.DATAFORSEO_PASSWORD!,
      baseUrl: process.env.DATAFORSEO_BASE_URL || "https://api.dataforseo.com",
    });
  }
  return dataforseoClient;
}