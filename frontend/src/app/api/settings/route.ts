import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { getSettings, resetSettings, saveSettings, type Settings } from "@/server/db";
import { backendEnabled, backendFetch } from "@/server/backend-client";

export const dynamic = "force-dynamic";

type BackendSettingsResponse = {
  workspace?: { name?: string };
  settings?: Partial<Settings>;
  domains?: Array<{ domain: string; isPrimary?: boolean }>;
};

async function requireSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

/**
 * Convert the backend's `{ workspace, settings, domains }` payload into the
 * `Settings` shape the frontend pages already consume.
 */
function fromBackend(payload: BackendSettingsResponse, base: Settings): Settings {
  const remote = payload.settings ?? {};
  const whitelist = payload.domains?.map((d) => d.domain).filter(Boolean);
  return {
    ...base,
    ...remote,
    workspaceName: payload.workspace?.name ?? remote.workspaceName ?? base.workspaceName,
    whitelist: whitelist && whitelist.length > 0 ? whitelist : (remote.whitelist ?? base.whitelist),
  };
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
