import { NextResponse } from "next/server";
import { cookieOptions, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth-session";
import { backendEnabled, backendLoginWithToken } from "@/server/backend-client";
import { logAuthEvent, verifyCredentials } from "@/server/db";

type BackendSession = {
  backendToken?: string;
  email: string;
  name: string;
  plan: string;
  userId?: string;
  workspaceId?: string;
};

/**
 * Authenticate against the Fastify backend first; fall back to the local
 * JSON-file user store when the backend is not running or rejects the request.
 */
async function resolveCredentials(email: string, password: string) {
  if (backendEnabled()) {
    const result = await backendLoginWithToken(email, password);
    if (result.ok && result.data.token) {
      const user = result.data.user;
      return {
        ok: true as const,
        source: "backend" as const,
        session: {
          backendToken: result.data.token,
          email: user?.email ?? email,
          name: user?.name ?? email,
          plan: user?.plan ?? "Starter",
          userId: user?.id,
          workspaceId: user?.workspaceId,
        } satisfies BackendSession,
      };
    }

    // The seeded demo account only exists in the local store, so allow local
    // verification as a fallback rather than locking the frontend out.
    if (result.status !== 0) {
      logAuthEvent(email.slice(0, 120), "failed");
    }
  }

  const localUser = verifyCredentials(email, password);
  if (!localUser) return { ok: false as const };

  return {
    ok: true as const,
    source: "local" as const,
    session: {
      backendToken: undefined,
      email: localUser.email,
      name: localUser.name,
      plan: localUser.plan,
      userId: localUser.id,
    } satisfies BackendSession,
  };
}

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
  }

  const resolved = await resolveCredentials(email, password);
  if (!resolved.ok) {
    logAuthEvent(email.slice(0, 120), "failed");
    return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
  }

  logAuthEvent(resolved.session.email, "login");

  const token = await createSessionToken({
    email: resolved.session.email,
    name: resolved.session.name,
    plan: resolved.session.plan,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    backendToken: resolved.session.backendToken,
    userId: resolved.session.userId,
    workspaceId: resolved.session.workspaceId,
  });

  const response = NextResponse.json({ ok: true, name: resolved.session.name });
  response.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return response;
}
