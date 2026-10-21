import { NextResponse } from "next/server";
import { cookieOptions, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth-session";
import { createUser } from "@/server/db";
import { backendEnabled, backendRegisterWithToken } from "@/server/backend-client";

export async function POST(request: Request) {
  let body: { name?: string; email?: string; password?: string; workspaceName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // 1. Prefer the backend, which owns users/workspaces going forward.
  if (backendEnabled()) {
    const result = await backendRegisterWithToken({
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
      workspaceName: body.workspaceName,
    });

    if (result.ok && result.data.token) {
      const user = result.data.user;
      const token = await createSessionToken({
        email: user.email,
        name: user.name,
        plan: user.plan,
        exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
        backendToken: result.data.token,
        userId: user.id,
        workspaceId: user.workspaceId,
      });
      const response = NextResponse.json({ ok: true, name: user.name, source: "backend" });
      response.cookies.set(SESSION_COOKIE, token, cookieOptions());
      return response;
    }

    // A validation conflict from the backend is authoritative — surface it.
    if (!result.ok && result.status === 409) {
      return NextResponse.json({ ok: false, error: result.error, field: "email" }, { status: 409 });
    }
    if (!result.ok && result.status >= 400 && result.status < 500) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    // status 0 (backend down) falls through to the local store.
  }

  // 2. Local fallback.
  const result = createUser({
    name: body.name ?? "",
    email: body.email ?? "",
    password: body.password ?? "",
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, field: result.field },
      { status: result.field === "email" ? 409 : 400 },
    );
  }

  const user = result.user;
  const token = await createSessionToken({
    email: user.email,
    name: user.name,
    plan: user.plan,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  });

  const response = NextResponse.json({ ok: true, name: user.name, source: "local" });
  response.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return response;
}
