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
    const { keyword, location_code = 2840, language_code = "en", depth = 10, grid_size = "5x5" } = body;

    if (!keyword) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }

    // Each grid point is a SERP request.
    const serpRequests = grid_size === "7x7" ? 49 : 25;

    // 1. Prefer the backend engine.
    if (backendEnabled()) {
      const { backendToken } = await getAuthUserWithBackendToken();
      const proxied = await backendFetch<{
        success: boolean;
        data: { items: unknown[]; gridPoints: number };
        creditsUsed: number;
        simulated: boolean;
        error?: string;
      }>("/api/dataforseo/maps", {
        body: { keyword, location_code, language_code, depth, grid_size },
        token: backendToken ?? undefined,
      });

      if (proxied.ok) {
        if (!proxied.data.simulated) {
          getBillingTracker().recordDataForSEOUsage(user.id, user.workspaceId, "maps_api", proxied.data.creditsUsed || serpRequests, {
            keyword: String(keyword).slice(0, 100),
            gridSize: grid_size,
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
    const result = await client.getMapsRankings({ keyword, location_code, language_code, depth, grid_size });

    // Track usage - each grid point is a SERP request
    getBillingTracker().recordDataForSEOUsage(user.id, user.workspaceId, "maps_api", serpRequests, {
      keyword: keyword.slice(0, 100),
      gridSize: grid_size,
    });

    return NextResponse.json({
      success: true,
      data: result.tasks?.[0]?.result ?? null,
      source: "local",
    });
  } catch (error) {
    console.error("Maps API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch maps rankings" },
      { status: 500 }
    );
  }
}
