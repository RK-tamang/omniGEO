import { NextRequest, NextResponse } from "next/server";
import { getPaymentClient, calculateTransactionFee, estimateMonthlyCost } from "@/server/services/payments";
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
    const { provider, plan, interval = "monthly", returnUrl, cancelUrl } = body;

    if (!provider || !plan) {
      return NextResponse.json({ error: "Provider and plan are required" }, { status: 400 });
    }

    // 1. Prefer the backend — it owns the payments table and the plan on the
    //    workspace, so initiating here keeps both stores in step.
    if (backendEnabled()) {
      const { backendToken } = await getAuthUserWithBackendToken();
      const proxied = await backendFetch<{
        success: boolean;
        paymentUrl?: string;
        paymentId?: string;
        orderId?: string;
        amount?: number;
        fee?: number;
        totalAmount?: number;
        error?: string;
      }>("/api/payments/initiate", {
        body: { provider, plan, interval, returnUrl, cancelUrl },
        token: backendToken ?? undefined,
      });

      if (proxied.ok) {
        return NextResponse.json({ ...proxied.data, source: "backend" });
      }
      // A 4xx is a validation problem the caller should see; anything else
      // (backend unreachable) falls through to the local implementation.
      if (proxied.status >= 400 && proxied.status < 500) {
        return NextResponse.json({ error: proxied.error }, { status: proxied.status });
      }
    }

    // 2. Local fallback — talks to the payment provider directly.
    const planPrices = { Starter: 4999, "Pro Growth": 12999, Enterprise: 29999 };
    const amount = planPrices[plan as keyof typeof planPrices];
    if (!amount) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const finalAmount = interval === "yearly" ? Math.round(amount * 12 * 0.8) : amount;
    const fee = calculateTransactionFee(finalAmount);
    const totalAmount = Math.round(finalAmount + fee);

    const orderId = `ord_${user.id}_${plan}_${interval}_${Date.now()}`;

    const client = getPaymentClient(provider);
    const result = await client.initiatePayment({
      provider,
      amount: totalAmount,
      currency: "NPR",
      orderId,
      customerInfo: {
        name: user.name,
        email: user.email,
        phone: user.profile?.phone || "",
      },
      returnUrl: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?payment=success`,
      cancelUrl: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing?payment=cancelled`,
      metadata: { plan, interval, userId: user.id },
    });

    return NextResponse.json({
      success: result.success,
      paymentUrl: result.paymentUrl,
      paymentId: result.paymentId,
      orderId,
      amount: finalAmount,
      fee,
      totalAmount,
      error: result.error,
    });
  } catch (error) {
    console.error("Payment Initiation API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initiate payment" },
      { status: 500 }
    );
  }
}