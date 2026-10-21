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
    const { prompt, model = "chatgpt", location_code = 2840, language_code = "en" } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // 1. Prefer the backend engine (live DataForSEO, simulated when unconfigured).
    if (backendEnabled()) {
      const { backendToken } = await getAuthUserWithBackendToken();
      const proxied = await backendFetch<{
        success: boolean;
        data: { answer?: string; citations: unknown[]; model: string };
        creditsUsed: number;
        simulated: boolean;
        error?: string;
      }>("/api/dataforseo/llm-mentions", {
        body: { prompt, model, location_code, language_code },
        token: backendToken ?? undefined,
      });

      if (proxied.ok) {
        if (!proxied.data.simulated) {
          getBillingTracker().recordDataForSEOUsage(user.id, user.workspaceId, "llm_api", proxied.data.creditsUsed || 1, {
            prompt: String(prompt).slice(0, 100),
            model,
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
    const result = await client.getLLMentions({ prompt, model, location_code, language_code });

    // Track usage
    getBillingTracker().recordDataForSEOUsage(user.id, user.workspaceId, "llm_api", 1, {
      prompt: prompt.slice(0, 100),
      model,
    });

    return NextResponse.json({
      success: true,
      data: result.tasks?.[0]?.result ?? null,
      source: "local",
    });
  } catch (error) {
    console.error("LLM Mentions API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch LLM mentions" },
      { status: 500 }
    );
  }
}
