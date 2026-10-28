import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth-session";
import { api } from "@/lib/api-client";

export const dynamic = "force-dynamic";

/**
 * Poll a geo-audit run for results.
 *
 * Proxies GET /api/v1/tools/geo-audit/{id}/results on the backend so the
 * scan-runner client can poll until status=completed, then open the report.
 *
 * Authentication: reads the omni_scan_token cookie set by the scan-start
 * route (which stores the access_token returned by geo-audit start), falling
 * back to the answerscope_session cookie for signed-in users. Sends it as an
 * Authorization: Bearer header, which is what the geo-audit results endpoint
 * expects.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Read auth token from cookies: scan-start token first, then session token
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMap = Object.fromEntries(
    cookieHeader.split("; ").map((c) => {
      const [key, ...valParts] = c.split("=");
      return [key.trim(), valParts.join("=")];
    }),
  );

  const token = cookieMap["omni_scan_token"] ?? cookieMap[SESSION_COOKIE] ?? undefined;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "No auth token available" },
      { status: 401 },
    );
  }

  const res = await api.getScanResults(id, token);

  if (!res.ok || !res.data) {
    return NextResponse.json(
      { ok: false, error: res.error || "Scan not found" },
      { status: res.status || 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    scan: res.data,
  });
}
