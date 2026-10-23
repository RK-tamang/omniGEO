import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { getSettings, resetSettings, saveSettings, type Settings } from "@/server/db";
import { backendEnabled, backendFetch } from "@/server/backend-client";
import { fromBackend, type BackendSettingsResponse } from "@/server/settings";

export const dynamic = "force-dynamic";

async function requireSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  // Prefer the backend's persisted settings (single source of truth).
  if (session.backendToken && backendEnabled()) {
    const result = await backendFetch<BackendSettingsResponse>("/api/settings", {
      method: "GET",
      token: session.backendToken,
    });
    if (result.ok) {
      const settings = fromBackend(result.data ?? {}, getSettings());
      return NextResponse.json(
        { ok: true, settings, source: "backend" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  return NextResponse.json(
    { ok: true, settings: getSettings(), source: "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const isReset = Boolean(body && typeof body === "object" && (body as { reset?: boolean }).reset);

  // Push to the backend first so browser and backend never drift.
  if (session.backendToken && backendEnabled()) {
    const patch = isReset ? undefined : (body as Record<string, unknown>);
    const result = await backendFetch<{ success: boolean; settings: Partial<Settings> }>("/api/settings", {
      method: "PATCH",
      body: patch ?? {},
      token: session.backendToken,
    });
    if (result.ok) {
      const settings = fromBackend({ settings: result.data?.settings }, getSettings());
      return NextResponse.json(
        { ok: true, settings, source: "backend" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (result.status >= 400 && result.status < 500 && result.status !== 401) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
  }

  if (isReset) {
    return NextResponse.json({ ok: true, settings: resetSettings(), source: "local" });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const settings = saveSettings(body as Partial<Settings>);
  return NextResponse.json({ ok: true, settings, source: "local" }, { headers: { "Cache-Control": "no-store" } });
}
