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
    const { keyword, location_code = 2840, language_code = "en", depth = 10, grid_size = "5x5" } = body;

    if (!keyword) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }

    const proxied = await backendFetch<{
      success: boolean;
      data: { items: unknown[]; gridPoints: number };
      creditsUsed: number;
      simulated: boolean;
      error?: string;
    }>("/api/v1/dataforseo/maps", {
      body: { keyword, location_code, language_code, depth, grid_size },
      headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
    });

    if (proxied.ok) {
      return NextResponse.json({ ...proxied.data, source: "backend" });
    }

    return NextResponse.json({ success: false, error: proxied.error }, { status: proxied.status || 502 });
  } catch (error) {
    console.error("Maps API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch maps rankings" },
      { status: 500 }
    );
  }
}
