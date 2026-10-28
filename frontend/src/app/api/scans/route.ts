import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendFetch } from "@/lib/api-client";

export const dynamic = "force-dynamic";

/**
 * Scan endpoints live only in the Rust backend. These routes are a thin
 * authenticated proxy so dashboard pages can call `/api/scans*` on the same
 * origin.
 */

const SCAN_TYPES = {
  visibility: "/api/v1/scans/visibility",
  audit: "/api/v1/scans/audit",
  crawler: "/api/v1/crawler/robots",
} as const;

type ScanType = keyof typeof SCAN_TYPES;

async function getSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = request.nextUrl.searchParams.get("limit");
  const path = limit ? `/api/v1/scans?limit=${encodeURIComponent(limit)}` : "/api/v1/scans";

  const proxied = await backendFetch<{ scans: unknown[] }>(path, {
    method: "GET",
    headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
  });

  if (!proxied.ok) {
    return NextResponse.json({ error: proxied.error, scans: [] }, { status: proxied.status || 502 });
  }
  return NextResponse.json(proxied.data);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { type?: string; [key: string]: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const type = body.type as ScanType | undefined;
  if (!type || !(type in SCAN_TYPES)) {
    return NextResponse.json(
      { error: "type must be one of: visibility, audit, crawler" },
      { status: 400 },
    );
  }

  const { type: _ignored, ...payload } = body;

  const proxied = await backendFetch<{ scanId: string; status: string; message?: string }>(
    SCAN_TYPES[type],
    { body: payload, headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {} },
  );

  if (!proxied.ok) {
    return NextResponse.json({ error: proxied.error }, { status: proxied.status || 502 });
  }
  return NextResponse.json({ ...proxied.data, source: "backend" });
}
