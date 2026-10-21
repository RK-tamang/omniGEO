import { NextRequest, NextResponse } from "next/server";
import { getDataForSEOClient } from "@/server/services/dataforseo";
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
    const { keywords, location_code = 2840, language_code = "en", include_serp_info = false } = body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: "Keywords array is required" }, { status: 400 });
    }

    // 1. Prefer the backend engine.
    if (backendEnabled()) {
      const { backendToken } = await getAuthUserWithBackendToken();
      const proxied = await backendFetch<{
        success: boolean;
        data: { keywords: unknown[] };
        creditsUsed: number;
        simulated: boolean;
        error?: string;
      }>("/api/dataforseo/keyword-ideas", {
        body: { keywords, location_code, language_code, include_serp_info },
        token: backendToken ?? undefined,
      });

      if (proxied.ok) {
        if (!proxied.data.simulated) {
          getBillingTracker().recordDataForSEOUsage(user.id, user.workspaceId, "keyword_ideas", 1, {
            keywordCount: keywords.length,
            source: "backend",
          });
        }
        return NextResponse.json({ ...proxied.data, source: "backend" });
      }

      if (proxied.status >= 400 && proxied.status < 500 && proxied.status !== 401) {
        return NextResponse.json({ success: false, error: proxied.error }, { status: 502 });
      }
    }

    // 2. Local fallback.
    const client = getDataForSEOClient();
    const result = await client.getKeywordIdeas({ keywords, location_code, language_code, include_serp_info });

    // Track usage
    getBillingTracker().recordDataForSEOUsage(user.id, user.workspaceId, "keyword_ideas", 1, {
      keywordCount: keywords.length,
    });

    return NextResponse.json({
      success: true,
      data: result.tasks?.[0]?.result ?? null,
      source: "local",
    });
  } catch (error) {
    console.error("Keyword Ideas API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch keyword ideas" },
      { status: 500 }
    );
  }
}
