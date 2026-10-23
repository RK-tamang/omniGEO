import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cookieOptions, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth-session";
import { backendEnabled, backendGuestWithToken } from "@/server/backend-client";
import { verifySessionToken } from "@/lib/auth-session";

/**
 * A guest session, so the public free scan has a tenant to run against.
 *
 * The backend owns guest users and workspaces; this route only mints the
 * Next.js session cookie that carries the backend's auth_token, so the rest of
 * the app can proxy as the same tenant.
 */
export async function POST() {
  const cookieStore = await cookies();
  const existing = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (existing?.backendToken) {
    return NextResponse.json({ ok: true, resumed: true });
  }

  if (!backendEnabled()) {
    return NextResponse.json({ ok: false, error: "Scan engine unavailable" }, { status: 503 });
  }

  const result = await backendGuestWithToken();
  if (!result.ok || !result.data?.token) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status || 502 });
  }

  const user = result.data.user;
  const token = await createSessionToken({
    email: user?.email ?? "guest@omnigeo.local",
    name: user?.name ?? "Guest Explorer",
    plan: user?.plan ?? "Starter",
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    backendToken: result.data.token,
    userId: user?.id,
    workspaceId: user?.workspaceId,
  });

  const response = NextResponse.json({ ok: true, name: user?.name ?? "Guest Explorer" });
  response.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return response;
}
