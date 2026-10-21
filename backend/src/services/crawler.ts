/**
 * Site crawler for the OmniGEO audit engine.
 * Providers: Firecrawl (paid), Jina AI (paid), and a keyless "native" fallback that
 * fetches the page directly and converts HTML to markdown-ish text.
 *
 * Provider resolution order: explicit request -> DEFAULT_CRAWLER_PROVIDER env ->
 * firecrawl when a live key is configured -> native (free).
 */

export type CrawlerProvider = "firecrawl" | "jina" | "native";

export interface CrawlData {
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
    language?: string;
  };
  screenshot?: string;
  wordCount: number;
  fetchedAt: string;
}

export interface ScrapeResult {
  success: boolean;
  provider: CrawlerProvider;
  data?: CrawlData;
  error?: string;
  creditsUsed: number;
  simulated: boolean;
}

import { isLiveCredential } from "./llm.js";

function resolveProvider(explicit?: CrawlerProvider): CrawlerProvider {
  if (explicit) return explicit;
  const configured = process.env.DEFAULT_CRAWLER_PROVIDER as CrawlerProvider | undefined;
  if (configured) return configured;
  return isLiveCredential(process.env.FIRECRAWL_API_KEY) ? "firecrawl" : "native";
}

function absoluteUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function stripHtml(html: string, baseUrl: string): { markdown: string; links: Array<{ url: string; text: string }> } {
  const links: Array<{ url: string; text: string }> = [];

  // Extract links before stripping tags.
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1].trim();
    const text = match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
    if (text) links.push({ url: absoluteUrl(href, baseUrl), text: text.slice(0, 120) });
  }

  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Keep heading structure as markdown.
  text = text
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_m, inner) => `\n# ${inner.replace(/<[^>]+>/g, "").trim()}\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_m, inner) => `\n## ${inner.replace(/<[^>]+>/g, "").trim()}\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_m, inner) => `\n### ${inner.replace(/<[^>]+>/g, "").trim()}\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner) => `\n- ${inner.replace(/<[^>]+>/g, "").trim()}`)
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, inner) => `\n${inner.replace(/<[^>]+>/g, "").trim()}\n`)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { markdown: text, links: links.slice(0, 100) };
}

function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      /* skip malformed JSON-LD */
    }
  }
  return blocks;
}

function metaContent(html: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(html);
  return match ? match[1].trim() : undefined;
}

async function scrapeNative(url: string): Promise<ScrapeResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; OmniGEO-AuditBot/1.0; +https://omnigeo.io/bot) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  }).catch((err: any) => ({ ok: false, status: 0, statusText: err?.message || "network error", text: async () => "" }) as any);

  if (!response.ok) {
    return {
      success: false,
      provider: "native",
      error: `Native fetch failed for ${url}: ${response.status} ${response.statusText || ""}`.trim(),
      creditsUsed: 0,
      simulated: false,
    };
  }

  const html = await response.text();
  const { markdown, links } = stripHtml(html, url);
  const title = metaContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || "";
  const description = metaContent(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || "";

  const data: CrawlData = {
    url: response.url || url,
    title,
    description,
    markdown,
    html,
    links,
    metadata: {
      ogTitle: metaContent(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i),
      ogDescription: metaContent(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i),
      ogImage: metaContent(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i),
      twitterCard: metaContent(html, /<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']*)["']/i),
      canonical: metaContent(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i),
      robots: metaContent(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i),
      language: metaContent(html, /<html[^>]+lang=["']([^"']*)["']/i),
      jsonLd: extractJsonLd(html),
    },
    wordCount: markdown.split(/\s+/).filter(Boolean).length,
    fetchedAt: new Date().toISOString(),
  };

  return { success: true, provider: "native", data, creditsUsed: 0, simulated: false };
}

async function scrapeFirecrawl(url: string, onlyMainContent: boolean): Promise<ScrapeResult> {
  const baseUrl = (process.env.FIRECRAWL_BASE_URL || "https://api.firecrawl.dev").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "links"],
      onlyMainContent,
      blockAds: true,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const body: any = await response.json().catch(() => ({}));

  if (!response.ok || !body.success) {
    return {
      success: false,
      provider: "firecrawl",
      error: body.error || `Firecrawl scrape failed (${response.status})`,
      creditsUsed: 1,
      simulated: false,
    };
  }

  const data: CrawlData = {
    url: body.data.url || url,
    title: body.data.metadata?.title || "",
    description: body.data.metadata?.description || "",
    markdown: body.data.markdown || "",
    html: body.data.html || "",
    links: (body.data.links || []).map((l: any) => ({ url: l.url, text: l.text })),
    metadata: {
      ogTitle: body.data.metadata?.ogTitle,
      ogDescription: body.data.metadata?.ogDescription,
      ogImage: body.data.metadata?.ogImage,
      twitterCard: body.data.metadata?.twitterCard,
      canonical: body.data.metadata?.canonical,
      robots: body.data.metadata?.robots,
      jsonLd: body.data.metadata?.jsonLd,
    },
    screenshot: body.data.screenshot,
    wordCount: (body.data.markdown || "").split(/\s+/).filter(Boolean).length,
    fetchedAt: new Date().toISOString(),
  };

  return { success: true, provider: "firecrawl", data, creditsUsed: 1, simulated: false };
}

async function scrapeJina(url: string): Promise<ScrapeResult> {
  const target = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
  const response = await fetch(target, {
    headers: {
      Authorization: `Bearer ${process.env.JINA_API_KEY}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    return {
      success: false,
      provider: "jina",
      error: `Jina AI error: ${response.status} ${response.statusText}`,
      creditsUsed: 1,
      simulated: false,
    };
  }

  const body: any = await response.json().catch(() => ({}));
  const content: string = body.data?.content || body.content || "";

  return {
    success: true,
    provider: "jina",
    data: {
      url,
      title: body.data?.title || "",
      description: body.data?.description || "",
      markdown: content,
      html: "",
      links: [],
      metadata: {},
      wordCount: content.split(/\s+/).filter(Boolean).length,
      fetchedAt: new Date().toISOString(),
    },
    creditsUsed: 1,
    simulated: false,
  };
}

/**
 * Scrape a single URL. If the selected provider fails and a fallback is available,
 * degrade gracefully instead of erroring the whole audit.
 */
export async function scrapeUrl(
  url: string,
  options: { provider?: CrawlerProvider; onlyMainContent?: boolean } = {}
): Promise<ScrapeResult> {
  const provider = resolveProvider(options.provider);
  let result: ScrapeResult;

  try {
    if (provider === "firecrawl") {
      result = await scrapeFirecrawl(url, options.onlyMainContent ?? true);
    } else if (provider === "jina") {
      result = await scrapeJina(url);
    } else {
      result = await scrapeNative(url);
    }
  } catch (error: any) {
    result = {
      success: false,
      provider,
      error: `${provider} request failed: ${error?.message || "network error"}`,
      creditsUsed: 0,
      simulated: false,
    };
  }

  // Degrade to the free native scraper when a paid provider fails.
  if (!result.success && provider !== "native") {
    const fallback = await scrapeNative(url).catch(() => null);
    if (fallback?.success) {
      return { ...fallback, error: `Fell back to native scraper: ${result.error}` };
    }
  }

  return result;
}

/** Scrape multiple URLs with small concurrency. */
export async function scrapeBulk(
  urls: string[],
  options: { provider?: CrawlerProvider; onlyMainContent?: boolean; concurrency?: number } = {}
): Promise<ScrapeResult[]> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 5));
  const results: ScrapeResult[] = [];

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((url) => scrapeUrl(url, { provider: options.provider, onlyMainContent: options.onlyMainContent }))
    );
    results.push(...batchResults);
  }

  return results;
}

/** Fetch a small text resource (robots.txt, sitemap index, llms.txt). */
export async function fetchTextResource(url: string): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "OmniGEO-AuditBot/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    const body = response.ok ? (await response.text().catch(() => "")).slice(0, 20_000) : "";
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: "" };
  }
}
