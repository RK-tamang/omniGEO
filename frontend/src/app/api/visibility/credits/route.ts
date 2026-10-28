import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendFetch } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const proxied = await backendFetch<Record<string, unknown>>("/api/v1/visibility/credits", {
    method: "GET",
    headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
  });

  if (!proxied.ok) {
    return NextResponse.json({ error: proxied.error }, { status: proxied.status || 502 });
  }
  return NextResponse.json(proxied.data);
}
