import { NextRequest, NextResponse } from "next/server";
import { getPaymentClient } from "@/server/services/payments";
import { getAuthUser } from "@/server/auth";
import { saveSettings, getSettings } from "@/server/db";
import { backendEnabled, backendFetch } from "@/server/backend-client";
import { getAuthUserWithBackendToken } from "@/server/auth-backend";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { provider, paymentId, orderId } = body;

    if (!provider || !paymentId || !orderId) {
      return NextResponse.json({ error: "Provider, paymentId, and orderId are required" }, { status: 400 });
    }

    // 1. Prefer the backend — it owns the payments table and is the only
    //    place that can move the workspace onto the new plan.
    if (backendEnabled()) {
      const { backendToken } = await getAuthUserWithBackendToken();
      const proxied = await backendFetch<{
        success: boolean;
        verified: boolean;
        transactionId?: string;
        amount?: number;
        error?: string;
      }>("/api/payments/verify", {
        body: { provider, paymentId, orderId },
        token: backendToken ?? undefined,
      });

      if (proxied.ok) {
        return NextResponse.json({ ...proxied.data, source: "backend" });
      }
      if (proxied.status >= 400 && proxied.status < 500) {
        return NextResponse.json({ error: proxied.error }, { status: proxied.status });
      }
    }

    // 2. Local fallback — verify with the payment provider directly.
    const client = getPaymentClient(provider);
    const result = await client.verifyPayment({ provider, paymentId, orderId });

    if (result.success && result.verified) {
      // Parse orderId to get plan info
      const parts = orderId.split("_");
      if (parts.length >= 4) {
        const plan = parts[2];
        const interval = parts[3];

        // Update user's plan in database
        const settings = getSettings();
        settings.plan = plan;
        settings.billingInterval = interval as "monthly" | "yearly";
        settings.billingCycleStart = new Date().toISOString();
        saveSettings(settings);
      }
    }

    return NextResponse.json({
      success: result.success,
      verified: result.verified,
      transactionId: result.transactionId,
      amount: result.amount,
      error: result.error,
      source: "local",
    });
  } catch (error) {
    console.error("Payment Verification API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify payment" },
      { status: 500 }
    );
  }
}