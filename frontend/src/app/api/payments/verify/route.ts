import { NextRequest, NextResponse } from "next/server";
import { getPaymentClient } from "@/server/services/payments";
import { getAuthUser } from "@/server/auth";
import { saveSettings, getSettings } from "@/server/db";

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
    });
  } catch (error) {
    console.error("Payment Verification API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify payment" },
      { status: 500 }
    );
  }
}