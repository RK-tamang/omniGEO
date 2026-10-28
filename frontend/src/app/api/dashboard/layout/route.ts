import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendFetch } from "@/lib/api-client";
import {
  DASHBOARD_BLOCKS,
  DASHBOARD_BLOCK_GROUPS,
  DASHBOARD_PRESETS,
  normalizeDashboardLayout,
  type DashboardLayout,
} from "@/lib/dashboard-layout";

export const dynamic = "force-dynamic";

/** The registry the client renders from — always sent so the UI never guesses. */
const CATALOG = {
  blocks: DASHBOARD_BLOCKS,
  groups: DASHBOARD_BLOCK_GROUPS,
  presets: DASHBOARD_PRESETS,
};

async function requireSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  if (session.backendToken) {
    const result = await backendFetch<{
      layout: DashboardLayout;
      blocks: typeof DASHBOARD_BLOCKS;
      groups: typeof DASHBOARD_BLOCK_GROUPS;
      presets: typeof DASHBOARD_PRESETS;
    }>("/api/dashboard/layout", {
      method: "GET",
      headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
    });

    if (result.ok && result.data) {
      return NextResponse.json(
        {
          ok: true,
          layout: normalizeDashboardLayout(result.data.layout),
          blocks: result.data.blocks ?? CATALOG.blocks,
          groups: result.data.groups ?? CATALOG.groups,
          presets: result.data.presets ?? CATALOG.presets,
          source: "backend",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  return NextResponse.json(
    {
      ok: true,
      layout: normalizeDashboardLayout({}),
      ...CATALOG,
      source: "local",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const layout = normalizeDashboardLayout(body);

  if (session.backendToken) {
    const result = await backendFetch<{ success: boolean; layout: DashboardLayout }>(
      "/api/dashboard/layout",
      { method: "PATCH", body: layout, token: session.backendToken },
    );

    if (result.ok) {
      return NextResponse.json(
        { ok: true, layout: result.data?.layout ?? layout, source: "backend" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if ((result.status ?? 0) >= 400 && (result.status ?? 0) < 500 && (result.status ?? 0) !== 401) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
  }

  return NextResponse.json(
    { ok: true, layout, source: "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
