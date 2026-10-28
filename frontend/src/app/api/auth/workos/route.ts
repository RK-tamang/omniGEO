import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/dashboard";

  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080";
  // Tell the backend where to redirect after WorkOS auth — the frontend callback URL.
  const callbackUrl = new URL("/api/auth/workos/callback", request.url);
  callbackUrl.searchParams.set("next", next);

  const params = new URLSearchParams();
  params.set("next", callbackUrl.toString());
  if (searchParams.get("screen_hint")) {
    params.set("screen_hint", searchParams.get("screen_hint")!);
  }

  return redirect(`${backendUrl}/api/v1/auth/workos/start?${params.toString()}`);
}
