import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cookieOptions, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/api-client';
import { backendGuestWithToken } from "@/lib/api-client";
import { verifySessionToken } from '@/lib/api-client';

export async function POST() {
  const cookieStore = await cookies();
  const existing = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (existing?.backendToken) {
    return NextResponse.json({ ok: true, resumed: true });
  }

  const result = await backendGuestWithToken();
  if (result.ok && result.data?.token) {
    const user = result.data.user || {};
    const token = await createSessionToken({
      email: user?.email ?? "guest@omnigeo.local",
      name: user?.name ?? "Guest Explorer",
      plan: user?.plan ?? "Starter",
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
      backendToken: result.data.token,
      userId: user?.id,
      workspaceId: user?.workspace_id || user?.workspaceId,
    });
    const response = NextResponse.json({ ok: true, name: user?.name ?? "Guest Explorer", source: "api" });
    response.cookies.set(SESSION_COOKIE, token, cookieOptions());
    return response;
  }

  const token = await createSessionToken({
    email: "guest@omnigeo.local",
    name: "Guest Explorer",
    plan: "Starter",
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    backendToken: undefined,
    userId: undefined,
    workspaceId: undefined,
  });
  const response = NextResponse.json({ ok: true, name: "Guest Explorer", local: true });
  response.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return response;
}