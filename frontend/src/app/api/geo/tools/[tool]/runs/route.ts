import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendFetch } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tool } = await params;
  const body = await request.json();

  const proxied = await backendFetch<Record<string, unknown>>(
    `/api/v1/tools/${encodeURIComponent(tool)}/runs`,
    { method: "POST", headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {}, body },
  );

  if (!proxied.ok) {
    return NextResponse.json({ error: proxied.error }, { status: proxied.status || 502 });
  }
  return NextResponse.json(proxied.data);
}
