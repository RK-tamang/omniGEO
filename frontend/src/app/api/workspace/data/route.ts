import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendEnabled, backendFetch } from "@/server/backend-client";

export const dynamic = "force-dynamic";

/**
 * The workspace's live data.
 *
 * The dashboard has a static demo dataset it renders when no backend is
 * running. This route proxies the backend's view of the workspace so the
 * dashboard can show what was actually tracked, generated and crawled.
 */
export async function GET() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  if (session.backendToken && backendEnabled()) {
    const result = await backendFetch<Record<string, unknown>>("/api/workspace/data", {
      method: "GET",
      token: session.backendToken,
    });

    if (result.ok && result.data) {
      return NextResponse.json(
        { ok: true, data: result.data, source: "backend" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (result.status >= 400 && result.status < 500) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }
  }

  return NextResponse.json(
    { ok: true, data: null, source: "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
