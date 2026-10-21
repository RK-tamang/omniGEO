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
    const { urls, provider, formats = ["markdown", "links"], onlyMainContent = true, webhook } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "URLs array is required" }, { status: 400 });
    }

    // Check plan limits
    const maxUrls = user.plan === "Starter" ? 50 : user.plan === "Pro Growth" ? 500 : 5000;
    if (urls.length > maxUrls) {
      return NextResponse.json(
        { error: `Bulk crawl limit exceeded. Max ${maxUrls} URLs for ${user.plan} plan` },
        { status: 400 }
      );
    }

    // 1. Prefer the backend engine, which persists every page into `crawls`.
    if (backendEnabled()) {
      const { backendToken } = await getAuthUserWithBackendToken();
      const proxied = await backendFetch<{
        success: boolean;
        pages: number;
        succeeded: number;
        failed: number;
        creditsUsed: number;
        data: unknown[];
      }>("/api/crawler/bulk", {
        body: { urls, provider, onlyMainContent },
        token: backendToken ?? undefined,
        timeoutMs: 180_000,
      });

      if (proxied.ok) {
        if (proxied.data.succeeded > 0) {
          getBillingTracker().recordCrawlerUsage(user.id, user.workspaceId, provider || "firecrawl", proxied.data.succeeded, {
            urlCount: urls.length,
            succeeded: proxied.data.succeeded,
            source: "backend",
          });
        }
        return NextResponse.json({
          success: proxied.data.success,
          pages: proxied.data.pages,
          succeeded: proxied.data.succeeded,
          failed: proxied.data.failed,
          estimatedCredits: proxied.data.creditsUsed,
          data: proxied.data.data,
          source: "backend",
        });
      }

      if (proxied.status >= 400 && proxied.status < 500 && proxied.status !== 401) {
        return NextResponse.json({ success: false, error: proxied.error }, { status: 400 });
      }
    }

    // 2. Local fallback.
    const client = getCrawlerClient();
    const result = await client.bulkCrawl({ urls, provider, formats, onlyMainContent, webhook });

    // Track usage (estimate - actual will be tracked via webhook)
    if (result.success) {
      getBillingTracker().recordCrawlerUsage(user.id, user.workspaceId, provider || "firecrawl", urls.length, {
        urlCount: urls.length,
        jobId: result.jobId,
      });
    }

    return NextResponse.json({
      success: result.success,
      jobId: result.jobId,
      estimatedCredits: urls.length,
      error: result.error,
      source: "local",
    });
  } catch (error) {
    console.error("Bulk Crawler API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start bulk crawl" },
      { status: 500 }
    );
  }
}
