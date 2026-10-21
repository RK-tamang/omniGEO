import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/server/auth";
import { backendEnabled, backendFetch } from "@/server/backend-client";
import { getAuthUserWithBackendToken } from "@/server/auth-backend";

/**
 * Scan endpoints live only in the Fastify backend (they need the engine, the
 * provider clients, and DB persistence). These routes are a thin authenticated
 * proxy so dashboard pages can call `/api/scans*` on the same origin.
 */

const SCAN_TYPES = {
  visibility: "/api/scans/visibility",
  audit: "/api/scans/audit",
  crawler: "/api/scans/crawler",
} as const;

type ScanType = keyof typeof SCAN_TYPES;

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!backendEnabled()) {
    return NextResponse.json({ error: "Scan engine unavailable", scans: [] }, { status: 503 });
  }

  const { backendToken } = await getAuthUserWithBackendToken();
  const limit = request.nextUrl.searchParams.get("limit");
  const path = limit ? `/api/scans?limit=${encodeURIComponent(limit)}` : "/api/scans";

  const proxied = await backendFetch<{ scans: unknown[] }>(path, {
    method: "GET",
    token: backendToken ?? undefined,
  });

  if (!proxied.ok) {
    return NextResponse.json({ error: proxied.error, scans: [] }, { status: proxied.status || 502 });
  }
  return NextResponse.json(proxied.data);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  if (!backendEnabled()) {
    return NextResponse.json({ error: "Scan engine unavailable" }, { status: 503 });
  }

  const { backendToken } = await getAuthUserWithBackendToken();
  const { type: _ignored, ...payload } = body;

  const proxied = await backendFetch<{ scanId: string; status: string; message?: string }>(
    SCAN_TYPES[type],
    { body: payload, token: backendToken ?? undefined, timeoutMs: 60_000 },
  );

  if (!proxied.ok) {
    return NextResponse.json({ error: proxied.error }, { status: proxied.status || 502 });
  }
  return NextResponse.json({ ...proxied.data, source: "backend" });
}
