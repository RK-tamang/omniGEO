import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/api-client";

import { backendFetch } from "@/lib/api-client";

export async function POST() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);


  if (session?.backendToken) {
    await backendFetch("/api/v1/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.backendToken}` },
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
