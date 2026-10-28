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
    const { keywords, location_code = 2840, language_code = "en", include_serp_info = false } = body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: "Keywords array is required" }, { status: 400 });
    }

    const proxied = await backendFetch<{
      success: boolean;
      data: { keywords: unknown[] };
      creditsUsed: number;
      simulated: boolean;
      error?: string;
    }>("/api/v1/dataforseo/keyword-ideas", {
      body: { keywords, location_code, language_code, include_serp_info },
      headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
    });

    if (proxied.ok) {
      return NextResponse.json({ ...proxied.data, source: "backend" });
    }

    return NextResponse.json({ success: false, error: proxied.error }, { status: proxied.status || 502 });
  } catch (error) {
    console.error("Keyword Ideas API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch keyword ideas" },
      { status: 500 }
    );
  }
}
