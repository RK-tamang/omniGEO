import { NextRequest, NextResponse } from "next/server";
import { getPaymentClient, calculateTransactionFee, estimateMonthlyCost } from "@/server/services/payments";
import { getAuthUser } from "@/server/auth";

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