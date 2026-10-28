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
    const { provider, paymentId, orderId } = body;

    if (!provider || !paymentId || !orderId) {
      return NextResponse.json({ error: "Provider, paymentId, and orderId are required" }, { status: 400 });
    }

    const proxied = await backendFetch<{
      success: boolean;
      verified: boolean;
      transactionId?: string;
      amount?: number;
      error?: string;
    }>("/api/v1/payments/verify", {
      body: { provider, paymentId, orderId },
      headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
    });

    if (proxied.ok) {
      return NextResponse.json({ ...proxied.data, source: "backend" });
    }

    return NextResponse.json({ error: proxied.error }, { status: proxied.status || 502 });
  } catch (error) {
    console.error("Payment Verification API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify payment" },
      { status: 500 }
    );
  }
}
