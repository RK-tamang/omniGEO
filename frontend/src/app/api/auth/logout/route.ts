import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { logAuthEvent } from "@/server/db";
import { backendEnabled, backendFetch } from "@/server/backend-client";

export async function POST() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (session) logAuthEvent(session.email, "logout");

  // Tell the backend too, so it clears its own auth cookie and records the
  // event. A failure here must not stop the local logout.
  if (session?.backendToken && backendEnabled()) {
    await backendFetch("/api/auth/logout", {
      method: "POST",
      token: session.backendToken,
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
