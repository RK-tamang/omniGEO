import { cookies } from "next/headers";
import { cookieOptions, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE, verifySessionToken } from "@/lib/auth-session";
import { backendEnabled, backendGuestWithToken } from "@/server/backend-client";

/**
 * Ensure there is a backend tenant to work against.
 *
 * Signed-in users already carry a backend token. For anyone else — the public
 * free scan, for instance — a guest session is minted on the backend and its
 * auth_token is carried in the Next.js session cookie.
 */
export async function ensureBackendSession(): Promise<{
  ok: boolean;
  backendToken: string | null;
  error?: string;
  status?: number;
}> {
  const cookieStore = await cookies();
  const existing = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (existing?.backendToken) {
    return { ok: true, backendToken: existing.backendToken };
  }

  if (existing) {
    // A session exists but has no backend token — it was issued while the
    // backend was down. Don't clobber it; ask the caller to sign in instead.
    return { ok: false, backendToken: null, error: "Sign in to run a scan.", status: 401 };
  }

  if (!backendEnabled()) {
    return { ok: false, backendToken: null, error: "Scan engine unavailable.", status: 503 };
  }

  const result = await backendGuestWithToken();
  if (!result.ok || !result.data?.token) {
    return { ok: false, backendToken: null, error: result.error, status: result.status || 502 };
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

  cookieStore.set(SESSION_COOKIE, token, cookieOptions());
  return { ok: true, backendToken: result.data.token };
}
