import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendFetch } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ found: false, bots: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const domain = request.nextUrl.searchParams.get("domain");
  const path = domain
    ? `/api/v1/crawler/robots?domain=${encodeURIComponent(domain)}`
    : "/api/v1/crawler/robots";

  const proxied = await backendFetch<Record<string, unknown>>(path, {
    method: "GET",
    headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
  });

  if (!proxied.ok) {
    return NextResponse.json({ found: false, bots: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(proxied.data, { headers: { "Cache-Control": "no-store" } });
}
