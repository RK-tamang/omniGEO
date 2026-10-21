import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/server/auth";
import { backendEnabled, backendFetch } from "@/server/backend-client";
import { getAuthUserWithBackendToken } from "@/server/auth-backend";

/** Poll a single scan's status/results from the backend engine. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!backendEnabled()) {
    return NextResponse.json({ error: "Scan engine unavailable" }, { status: 503 });
  }

  const { id } = await params;
  const { backendToken } = await getAuthUserWithBackendToken();

  const proxied = await backendFetch<Record<string, unknown>>(
    `/api/scans/${encodeURIComponent(id)}`,
    { method: "GET", token: backendToken ?? undefined },
  );

  if (!proxied.ok) {
    return NextResponse.json({ error: proxied.error }, { status: proxied.status || 502 });
  }
  return NextResponse.json(proxied.data);
}
