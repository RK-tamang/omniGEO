import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/server/services/llm";
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
    const { prompt, systemPrompt, temperature = 0.7, maxTokens = 4000, model = "gpt-4o-mini" } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // 1. Prefer the backend engine, which persists into `content_items`.
    if (backendEnabled()) {
      const { backendToken } = await getAuthUserWithBackendToken();
      const proxied = await backendFetch<{
        success: boolean;
        itemId?: string;
        content: string;
        usage: { promptTokens: number; completionTokens: number; totalTokens: number; estimatedCost: number };
        model: string;
        simulated?: boolean;
        error?: string;
      }>("/api/content/generate", {
        body: { prompt, systemPrompt, maxTokens, model },
        token: backendToken ?? undefined,
        timeoutMs: 180_000,
      });

      if (proxied.ok) {
        getBillingTracker().recordLLMUsage(
          user.id,
          user.workspaceId,
          proxied.data.model,
          proxied.data.usage?.promptTokens ?? 0,
          proxied.data.usage?.completionTokens ?? 0,
          { type: "content_generation", promptPreview: String(prompt).slice(0, 100), source: "backend" },
        );
        return NextResponse.json({ ...proxied.data, source: "backend" });
      }

      if (proxied.status >= 400 && proxied.status < 500 && proxied.status !== 401) {
        return NextResponse.json({ success: false, error: proxied.error }, { status: 502 });
      }
    }

    // 2. Local fallback.
    const client = getOpenAIClient();
    const localModel = (model === "gpt-4o" || model === "gpt-4-turbo" ? model : "gpt-4o-mini") as
      | "gpt-4o-mini"
      | "gpt-4o"
      | "gpt-4-turbo";
    const result = await client.generate({ prompt, systemPrompt, temperature, maxTokens, model: localModel });

    // Track usage
    getBillingTracker().recordLLMUsage(user.id, user.workspaceId, localModel, result.usage.promptTokens, result.usage.completionTokens, {
      type: "content_generation",
      promptPreview: prompt.slice(0, 100),
    });

    return NextResponse.json({
      success: true,
      content: result.content,
      usage: result.usage,
      model: localModel,
      source: "local",
    });
  } catch (error) {
    console.error("Content Generation API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate content" },
      { status: 500 }
    );
  }
}
