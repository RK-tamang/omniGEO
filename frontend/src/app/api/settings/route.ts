import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { apiFetch } from "@/lib/api-client";

export const dynamic = "force-dynamic";

async function requireSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  if (session.backendToken) {
    const result = await apiFetch<any>("/api/v1/settings", {
      method: "GET",
      headers: { Authorization: `Bearer ${session.backendToken}` },
    });
    if (result.ok) {
      const settings = (result.data as any)?.settings || result.data || {};
      return NextResponse.json(
        { ok: true, settings, source: "api" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  return NextResponse.json(
    { ok: true, settings: {}, source: "local" },
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

  if (session.backendToken) {
    const patch = isReset ? undefined : (body as Record<string, unknown>);
    const result = await apiFetch<any>("/api/v1/settings", {
      method: "PATCH",
      body: patch ?? {},
      headers: { Authorization: `Bearer ${session.backendToken}` },
    });
    if (result.ok) {
      const settings = (result.data as any)?.settings || result.data || {};
      return NextResponse.json(
        { ok: true, settings, source: "backend" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if ((result.status ?? 0) >= 400 && (result.status ?? 0) < 500 && (result.status ?? 0) !== 401) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
  }

  if (isReset) {
    return NextResponse.json({ ok: true, settings: {}, source: "local" });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, settings: body, source: "local" }, { headers: { "Cache-Control": "no-store" } });
}
