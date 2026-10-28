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
    const { url, provider, formats = ["markdown", "links"], onlyMainContent = true } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const proxied = await backendFetch<{
      success: boolean;
      data?: unknown;
      error?: string;
      creditsUsed: number;
      provider: string;
    }>("/api/v1/crawler/scrape", {
      body: { url, provider, onlyMainContent },
      headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
    });

    if (proxied.ok) {
      return NextResponse.json({ ...proxied.data, source: "backend" });
    }

    return NextResponse.json(
      { success: false, error: proxied.error, creditsUsed: 0 },
      { status: proxied.status || 502 }
    );
  } catch (error) {
    console.error("Crawler API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to crawl URL" },
      { status: 500 }
    );
  }
}
