import { NextRequest, NextResponse } from "next/server";
import { getBillingTracker } from "@/server/services/billing";
import { getAuthUser } from "@/server/auth";
import { backendEnabled, backendFetch } from "@/server/backend-client";
import { getAuthUserWithBackendToken } from "@/server/auth-backend";

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
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get("endDate") || new Date().toISOString();
    const workspaceId = searchParams.get("workspaceId") || user.workspaceId;

    // 1. Prefer the backend's persisted `billing_usage` ledger.
    if (backendEnabled()) {
      const { backendToken } = await getAuthUserWithBackendToken();
      const query = new URLSearchParams({ startDate, endDate, workspaceId });
      const proxied = await backendFetch<BackendUsage>(`/api/billing/usage?${query}`, {
        method: "GET",
        token: backendToken ?? undefined,
      });

      if (proxied.ok) {
        return NextResponse.json({
          success: true,
          summary: proxied.data.summary,
          records: proxied.data.records.slice(0, 100),
          source: "backend",
        });
      }
    }

    // 2. Local fallback (in-memory tracker).
    const tracker = getBillingTracker();
    const records = tracker.getUsageRecords({ userId: user.id, workspaceId, startDate, endDate });
    const summary = tracker.getBillingSummary(user.id, startDate, endDate);

    return NextResponse.json({
      success: true,
      summary,
      records: records.slice(0, 100), // Limit to 100 most recent
      source: "local",
    });
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
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { service, operation, quantity, extra } = body;

    const tracker = getBillingTracker();
    const estimate = tracker.estimateOperationCost(service, operation, quantity, extra);

    return NextResponse.json({
      success: true,
      estimate,
    });
  } catch (error) {
    console.error("Billing Estimate API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to estimate cost" },
      { status: 500 }
    );
  }
}
