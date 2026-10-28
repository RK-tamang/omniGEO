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
  const ownership = searchParams.get("ownership");
  const engine = searchParams.get("engine");
  const limit = searchParams.get("limit") ?? "50";
  const offset = searchParams.get("offset") ?? "0";

  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  params.set("limit", limit);
  params.set("offset", offset);
  if (ownership) params.set("ownership", ownership);
  if (engine) params.set("engine", engine);

  const proxied = await backendFetch<any>(
    `/api/v1/visibility/citations/domains?${params.toString()}`,
    { method: "GET", headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {} },
  );

  if (!proxied.ok) {
    return NextResponse.json({ error: proxied.error }, { status: proxied.status || 502 });
  }
  return NextResponse.json(proxied.data);
}
