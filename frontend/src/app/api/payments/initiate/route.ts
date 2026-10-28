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
    const { provider, plan, interval = "monthly", returnUrl, cancelUrl } = body;

    if (!provider || !plan) {
      return NextResponse.json({ error: "Provider and plan are required" }, { status: 400 });
    }

    const proxied = await backendFetch<{
      success: boolean;
      paymentUrl?: string;
      paymentId?: string;
      orderId?: string;
      amount?: number;
      fee?: number;
      totalAmount?: number;
      error?: string;
    }>("/api/v1/payments/initiate", {
      body: { provider, plan, interval, returnUrl, cancelUrl },
      headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
    });

    if (proxied.ok) {
      return NextResponse.json({ ...proxied.data, source: "backend" });
    }

    return NextResponse.json({ error: proxied.error }, { status: proxied.status || 502 });
  } catch (error) {
    console.error("Payment Initiation API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initiate payment" },
      { status: 500 }
    );
  }
}
