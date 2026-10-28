import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendFetch } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { content, instruction, format = "markdown", model = "claude-3-5-haiku" } = body;

    if (!content || !instruction) {
      return NextResponse.json({ error: "Content and instruction are required" }, { status: 400 });
    }

    const proxied = await backendFetch<{
      success: boolean;
      content: string;
      usage: { promptTokens: number; completionTokens: number; totalTokens: number; estimatedCost: number };
      model: string;
      simulated?: boolean;
      error?: string;
    }>("/api/v1/content/modify", {
      body: { content, instruction, format, model },
      headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
    });

    if (proxied.ok) {
      return NextResponse.json({ ...proxied.data, source: "backend" });
    }

    return NextResponse.json({ success: false, error: proxied.error }, { status: proxied.status || 502 });
  } catch (error) {
    console.error("Gap Modifier API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to modify content" },
      { status: 500 }
    );
  }
}
