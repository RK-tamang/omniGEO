import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/server/services/llm";
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
    const { content, instruction, format = "markdown", model = "claude-3-5-haiku" } = body;

    if (!content || !instruction) {
      return NextResponse.json({ error: "Content and instruction are required" }, { status: 400 });
    }

    // 1. Prefer the backend engine (real Anthropic call + billing row).
    if (backendEnabled()) {
      const { backendToken } = await getAuthUserWithBackendToken();
      const proxied = await backendFetch<{
        success: boolean;
        content: string;
        usage: { promptTokens: number; completionTokens: number; totalTokens: number; estimatedCost: number };
        model: string;
        simulated?: boolean;
        error?: string;
      }>("/api/content/modify", {
        body: { content, instruction, format, model },
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
          { type: "gap_modifier", format, source: "backend" },
        );
        return NextResponse.json({ ...proxied.data, source: "backend" });
      }

      if (proxied.status >= 400 && proxied.status < 500 && proxied.status !== 401) {
        return NextResponse.json({ success: false, error: proxied.error }, { status: 502 });
      }
    }

    // 2. Local fallback.
    const client = getAnthropicClient();
    const localModel = (model === "claude-3-5-sonnet" ? "claude-3-5-sonnet" : "claude-3-5-haiku") as
      | "claude-3-5-haiku"
      | "claude-3-5-sonnet";
    const result = await client.modify({ content, instruction, format, model: localModel });

    // Track usage
    getBillingTracker().recordLLMUsage(user.id, user.workspaceId, localModel, result.usage.promptTokens, result.usage.completionTokens, {
      type: "gap_modifier",
      format,
    });

    return NextResponse.json({
      success: true,
      content: result.content,
      usage: result.usage,
      model: localModel,
      source: "local",
    });
  } catch (error) {
    console.error("Gap Modifier API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to modify content" },
      { status: 500 }
    );
  }
}
