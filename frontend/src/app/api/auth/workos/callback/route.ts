import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieOptions, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionToken = searchParams.get("session_token");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");

  if (error || !sessionToken) {
    return redirect(`/login?error=workos_failed`);
  }

  // Try to fetch user info from the backend using the session token
  let email = "";
  let name = "";
  try {
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080";
    const meRes = await fetch(`${backendUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      cache: "no-store",
    });
    if (meRes.ok) {
      const meData = await meRes.json();
      const user = meData.user ?? meData;
      email = user?.email ?? "";
      name = user?.display_name ?? user?.name ?? "";
    }
  } catch {
    // ignore — we'll still create a session with the backend token
  }

  const token = await createSessionToken({
    email,
    name,
    plan: "Starter",
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    backendToken: sessionToken,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, cookieOptions());

  const redirectUrl = next.startsWith("/") ? next : "/dashboard";
  return redirect(redirectUrl);
}
