import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendFetch } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  const range = searchParams.get("range") ?? "30d";
  const engine = searchParams.get("engine");

  const qs = new URLSearchParams();
  if (projectId) qs.set("project_id", projectId);
  qs.set("range", range);
  if (engine) qs.set("engine", engine);

  const proxied = await backendFetch<any>(
    `/api/v1/visibility/citations/pages/${encodeURIComponent(pageId)}?${qs.toString()}`,
    { method: "GET", headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {} },
  );

  if (!proxied.ok) {
    return NextResponse.json({ error: proxied.error }, { status: proxied.status || 502 });
  }
  return NextResponse.json(proxied.data);
}
