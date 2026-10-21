/**
 * Site Crawler API client
 * Supports Firecrawl and Jina AI for parsing HTML, JS & competitor URLs
 * Cost: $0.001 / crawled page
 */

export type CrawlerProvider = "firecrawl" | "jina";

export interface CrawlRequest {
  url: string;
  provider?: CrawlerProvider;
  formats?: ("markdown" | "html" | "links" | "screenshot")[];
  onlyMainContent?: boolean;
  waitFor?: number;
  blockAds?: boolean;
  blockResources?: boolean;
}

export interface CrawlResponse {
  success: boolean;
  data?: {
    url: string;
    title: string;
    description: string;
    markdown: string;
    html: string;
    links: Array<{ url: string; text: string }>;
    metadata: {
      ogTitle?: string;
      ogDescription?: string;
      ogImage?: string;
      twitterCard?: string;
      canonical?: string;
      robots?: string;
      jsonLd?: unknown[];
    };
    screenshot?: string;
  };
  error?: string;
  creditsUsed: number;
}

export interface BulkCrawlRequest {
  urls: string[];
  provider?: CrawlerProvider;
  formats?: ("markdown" | "html" | "links")[];
  onlyMainContent?: boolean;
  webhook?: string;
}

export interface BulkCrawlResponse {
  success: boolean;
  jobId?: string;
  data?: CrawlResponse["data"][];
  error?: string;
  creditsUsed: number;
}

export class CrawlerClient {
  private firecrawlKey: string;
  private jinaKey: string;
  private defaultProvider: CrawlerProvider;

  constructor() {
    this.firecrawlKey = process.env.FIRECRAWL_API_KEY!;
    this.jinaKey = process.env.JINA_API_KEY!;
    this.defaultProvider = (process.env.DEFAULT_CRAWLER_PROVIDER as CrawlerProvider) || "firecrawl";
  }

  async crawl(request: CrawlRequest): Promise<CrawlResponse> {
    const provider = request.provider || this.defaultProvider;

    if (provider === "firecrawl") {
      return this.crawlFirecrawl(request);
    }
    return this.crawlJina(request);
  }

  private async crawlFirecrawl(request: CrawlRequest): Promise<CrawlResponse> {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: request.url,
        formats: request.formats || ["markdown", "links"],
        onlyMainContent: request.onlyMainContent ?? true,
        waitFor: request.waitFor,
        blockAds: request.blockAds ?? true,
        blockResources: request.blockResources ?? true,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error || "Firecrawl scrape failed",
        creditsUsed: 1,
      };
    }

    return {
      success: true,
      data: {
        url: data.data.url,
        title: data.data.metadata?.title || "",
        description: data.data.metadata?.description || "",
        markdown: data.data.markdown || "",
        html: data.data.html || "",
        links: data.data.links?.map((l: { url: string; text: string }) => ({ url: l.url, text: l.text })) || [],
        metadata: {
          ogTitle: data.data.metadata?.ogTitle,
          ogDescription: data.data.metadata?.ogDescription,
          ogImage: data.data.metadata?.ogImage,
          twitterCard: data.data.metadata?.twitterCard,
          canonical: data.data.metadata?.canonical,
          robots: data.data.metadata?.robots,
          jsonLd: data.data.metadata?.jsonLd,
        },
        screenshot: data.data.screenshot,
      },
      creditsUsed: 1,
    };
  }

  private async crawlJina(request: CrawlRequest): Promise<CrawlResponse> {
    const url = new URL("https://r.jina.ai/http://" + request.url.replace(/^https?:\/\//, ""));
    url.searchParams.set("format", "markdown");
    if (request.onlyMainContent !== false) url.searchParams.set("no-images", "true");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.jinaKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Jina AI error: ${response.statusText}`,
        creditsUsed: 1,
      };
    }

    const data = await response.json();

    return {
      success: true,
      data: {
        url: request.url,
        title: data.data?.title || "",
        description: data.data?.description || "",
        markdown: data.data?.content || "",
        html: "",
        links: [],
        metadata: {},
      },
      creditsUsed: 1,
    };
  }

  async bulkCrawl(request: BulkCrawlRequest): Promise<BulkCrawlResponse> {
    const provider = request.provider || this.defaultProvider;

    if (provider === "firecrawl") {
      return this.bulkCrawlFirecrawl(request);
    }
    return this.bulkCrawlJina(request);
  }

  private async bulkCrawlFirecrawl(request: BulkCrawlRequest): Promise<BulkCrawlResponse> {
    const response = await fetch("https://api.firecrawl.dev/v1/crawl", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        urls: request.urls,
        formats: request.formats || ["markdown", "links"],
        onlyMainContent: request.onlyMainContent ?? true,
        webhook: request.webhook,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return { success: false, error: data.error, creditsUsed: request.urls.length };
    }

    return {
      success: true,
      jobId: data.jobId,
      creditsUsed: request.urls.length,
    };
  }

  private async bulkCrawlJina(request: BulkCrawlRequest): Promise<BulkCrawlResponse> {
    return { success: false, error: "Jina AI bulk crawl not supported", creditsUsed: 0 };
  }
}

let crawlerClient: CrawlerClient | null = null;

export function getCrawlerClient(): CrawlerClient {
  if (!crawlerClient) {
    crawlerClient = new CrawlerClient();
  }
  return crawlerClient;
}

/**
 * Estimate crawl cost
 * Cost: $0.001 / crawled page
 */
export function estimateCrawlCost(pageCount: number): number {
  return pageCount * 0.001;
}