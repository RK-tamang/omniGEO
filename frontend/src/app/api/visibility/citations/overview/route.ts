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
  const range = searchParams.get("range") ?? "30d";
  const engine = searchParams.get("engine");
  const methodology = searchParams.get("methodology");

  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  params.set("range", range);
  if (engine) params.set("engine", engine);
  if (methodology) params.set("methodology", methodology);

  const proxied = await backendFetch<any>(
    `/api/v1/visibility/citations/overview?${params.toString()}`,
    { method: "GET", headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {} },
  );

  if (!proxied.ok) {
    return NextResponse.json({ error: proxied.error }, { status: proxied.status || 502 });
  }
  return NextResponse.json(proxied.data);
}
