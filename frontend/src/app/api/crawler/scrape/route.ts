import { NextRequest, NextResponse } from "next/server";
import { getCrawlerClient } from "@/server/services/crawler";
import { getBillingTracker } from "@/server/services/billing";
import { getAuthUser } from "@/server/auth";
import { backendEnabled, backendFetch } from "@/server/backend-client";
import { getAuthUserWithBackendToken } from "@/server/auth-backend";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { url, provider, formats = ["markdown", "links"], onlyMainContent = true } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // 1. Prefer the backend engine (Firecrawl/Jina/native with graceful fallback).
    if (backendEnabled()) {
      const { backendToken } = await getAuthUserWithBackendToken();
      const proxied = await backendFetch<{
        success: boolean;
        data?: unknown;
        error?: string;
        creditsUsed: number;
        provider: string;
      }>("/api/crawler/scrape", {
        body: { url, provider, onlyMainContent },
        token: backendToken ?? undefined,
        timeoutMs: 120_000,
      });

      if (proxied.ok) {
        // Mirror spend into the frontend tracker the billing dashboards read.
        if (proxied.data.success) {
          getBillingTracker().recordCrawlerUsage(
            user.id,
            user.workspaceId,
            proxied.data.provider === "jina" ? "jina" : "firecrawl",
            proxied.data.creditsUsed || 1,
            { url, provider: proxied.data.provider, source: "backend" },
          );
        }
        return NextResponse.json({ ...proxied.data, source: "backend" });
      }

      // A real upstream failure (bad URL, 404) should not silently retry locally.
      if (proxied.status >= 400 && proxied.status < 500 && proxied.status !== 401) {
        return NextResponse.json(
          { success: false, error: proxied.error, creditsUsed: 0 },
          { status: 200 },
        );
      }
      // Otherwise (backend down/unauthenticated) fall through to the local client.
    }

    // 2. Local fallback.
    const client = getCrawlerClient();
    const result = await client.crawl({ url, provider, formats, onlyMainContent });

    // Track usage
    if (result.success) {
      getBillingTracker().recordCrawlerUsage(user.id, user.workspaceId, result.data ? (provider || "firecrawl") : "firecrawl", 1, {
        url,
        provider: provider || "firecrawl",
      });
    }

    return NextResponse.json({
      success: result.success,
      data: result.data,
      error: result.error,
      creditsUsed: result.creditsUsed,
      source: "local",
    });
  } catch (error) {
    console.error("Crawler API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to crawl URL" },
      { status: 500 }
    );
  }
}
