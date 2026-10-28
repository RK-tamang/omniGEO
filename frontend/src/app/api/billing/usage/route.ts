import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/api-client";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth-session";
import { cookies } from "next/headers";

type BackendUsageRecord = {
  id: string;
  service: string;
  operation: string;
  quantity: number;
  costUsd: number;
  costNpr: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type BackendUsage = {
  summary: {
    period: { start: string; end: string };
    totalCostUsd: number;
    totalCostNpr: number;
    breakdown: Array<{ service: string; operations: number; costUsd: number; costNpr: number }>;
  };
  records: BackendUsageRecord[];
};

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    const user = session ? { id: session.userId, email: session.email } : null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get("endDate") || new Date().toISOString();
    const workspaceId = searchParams.get("workspaceId") || "";

    // 1. Use API at localhost:8080
    try {
      const cookieStore = await cookies();
      const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
      const query = new URLSearchParams({ startDate, endDate, workspaceId: workspaceId || "" });
      const proxied = await backendFetch<BackendUsage>(`/api/v1/billing/usage?${query}`, {
        method: "GET",
        headers: session?.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
      });

      if (proxied.ok && proxied.data) {
        return NextResponse.json({
          success: true,
          summary: proxied.data.summary,
          records: (proxied.data.records || []).slice(0, 100),
          source: "api",
        });
      }
    } catch (e) {
      // fall through
    }

    return NextResponse.json(
      { success: false, error: "Billing usage unavailable", source: "api" },
      { status: 502 },
    );
  } catch (error) {
    console.error("Billing Usage API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch billing usage" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!session?.backendToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { service, operation, quantity, extra } = body;

    return NextResponse.json({
      success: true,
      estimate: { service, operation, quantity, costUsd: 0 },
    });
  } catch (error) {
    console.error("Billing Estimate API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to estimate cost" },
      { status: 500 }
    );
  }
}
