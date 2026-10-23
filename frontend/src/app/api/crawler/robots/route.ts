import { NextRequest, NextResponse } from "next/server";
import { backendEnabled, backendFetch } from "@/server/backend-client";
import { getAuthUserWithBackendToken } from "@/server/auth-backend";

export const dynamic = "force-dynamic";

/**
 * Live AI crawler access for a domain.
 *
 * The backend fetches the real robots.txt and reports which answer-engine bots
 * can reach the site. Nothing is estimated here.
 */
export async function GET(request: NextRequest) {
  const { backendToken } = await getAuthUserWithBackendToken();
  if (!backendToken || !backendEnabled()) {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 503 });
  }

  const domain = request.nextUrl.searchParams.get("domain");
  const path = domain
    ? `/api/crawler/robots?domain=${encodeURIComponent(domain)}`
    : "/api/crawler/robots";

  const proxied = await backendFetch<Record<string, unknown>>(path, {
    method: "GET",
    token: backendToken,
  });

  if (!proxied.ok) {
    return NextResponse.json({ error: proxied.error }, { status: proxied.status || 502 });
  }

  return NextResponse.json(proxied.data, { headers: { "Cache-Control": "no-store" } });
}
