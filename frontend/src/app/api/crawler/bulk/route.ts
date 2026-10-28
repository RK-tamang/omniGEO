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
    const { urls, provider, formats = ["markdown", "links"], onlyMainContent = true, webhook } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "URLs array is required" }, { status: 400 });
    }

    const proxied = await backendFetch<{
      success: boolean;
      pages: number;
      succeeded: number;
      failed: number;
      creditsUsed: number;
      data: unknown[];
    }>("/api/v1/crawler/bulk", {
      body: { urls, provider, onlyMainContent },
      headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
    });

    if (proxied.ok && proxied.data) {
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

    return NextResponse.json({ success: false, error: proxied.error || "Bulk crawl failed" }, { status: proxied.status || 502 });
  } catch (error) {
    console.error("Bulk Crawler API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start bulk crawl" },
      { status: 500 }
    );
  }
}
