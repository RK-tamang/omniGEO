import { NextResponse } from "next/server";
import { cookieOptions, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/api-client';
import { backendLoginWithToken } from "@/lib/api-client";


type BackendSession = {
  backendToken?: string;
  email: string;
  name: string;
  plan: string;
  userId?: string;
  workspaceId?: string;
};

async function resolveCredentials(email: string, password: string) {
  const result = await backendLoginWithToken(email, password);
  if (result.ok && (result.data?.token || result.data?.session_token || result.data?.user)) {
    const user = result.data?.user || result.data;
    const backendToken = result.data?.token ?? result.data?.session_token;
    return {
      ok: true as const,
      source: "api" as const,
      session: {
        backendToken,
        email: user?.email ?? email,
        name: user?.name ?? user?.display_name ?? email,
        plan: user?.plan ?? "Starter",
        userId: user?.id,
        workspaceId: user?.workspaceId,
      } satisfies BackendSession,
    };
  }

  return { ok: false as const };
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
    return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
  }

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