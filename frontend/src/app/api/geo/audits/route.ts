import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendFetch } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  const limit = searchParams.get("limit");
  const offset = searchParams.get("offset");

  let url = "/api/v1/audits";
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (limit) params.set("limit", limit);
  if (offset) params.set("offset", offset);
  const qs = params.toString();
  if (qs) url += `?${qs}`;

  const proxied = await backendFetch<Record<string, unknown>>(url, {
    method: "GET",
    headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
  });

  if (!proxied.ok) {
    return NextResponse.json({ error: proxied.error }, { status: proxied.status || 502 });
  }
  return NextResponse.json(proxied.data);
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const proxied = await backendFetch<Record<string, unknown>>("/api/v1/tools/geo-audit/runs", {
    method: "POST",
    headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
    body,
  });

  if (!proxied.ok) {
    return NextResponse.json({ error: proxied.error }, { status: proxied.status || 502 });
  }
  return NextResponse.json(proxied.data);
}
