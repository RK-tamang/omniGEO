import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import api from "@/lib/api-client";

export const dynamic = "force-dynamic";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/**
 * Start a real scan using the backend's geo-audit tool.
 *
 * Ensures a tenant exists (guest session for unauthenticated visitors),
 * queues a geo-audit against the domain, and returns the audit ID so the
 * client can poll /api/scans/:id until the report is ready.
 *
 * The geo-audit start endpoint returns an access_token that must be sent
 * with the results request — this endpoint stores it in the session so the
 * polling route can use it.
 */
export async function POST(request: NextRequest) {
  let body: { domain?: string; prompts?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const domain = (body.domain ?? "").trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (!DOMAIN_RE.test(domain)) {
    return NextResponse.json({ ok: false, error: "Enter a domain like example.com" }, { status: 400 });
  }

  const res = await api.getScan(domain);

  if (!res.ok || !res.data) {
    return NextResponse.json(
      { ok: false, error: res.error || "Could not start the geo-audit." },
      { status: res.status || 502 },
    );
  }

  const data = res.data as any;

  // Persist the access_token returned by geo-audit start so the polling
  // route can authenticate the results request (results endpoint requires auth).
  if (data.access_token) {
    const cookieStore = await cookies();
    cookieStore.set("omni_scan_token", data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }

  return NextResponse.json({
    ok: true,
    domain,
    scans: {
      audit: data.audit_id,
      visibility: null, // geo-audit combines crawl + visibility in one run
    },
  });
}
