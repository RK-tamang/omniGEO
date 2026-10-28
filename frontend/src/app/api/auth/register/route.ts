import { NextResponse } from "next/server";
import { cookieOptions, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/api-client';
import { backendRegisterWithToken } from "@/lib/api-client";

export async function POST(request: Request) {
  let body: {
    name?: string;
    email?: string;
    password?: string;
    brandName?: string;
    category?: string;
    website?: string;
    market?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const missing = ["name", "email", "password", "brandName", "category", "website"].filter(
    (k) => !body[k as keyof typeof body],
  );
  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Missing: ${missing.join(", ")}.` },
      { status: 400 },
    );
  }

  const result = await backendRegisterWithToken({
    name: body.name ?? "",
    email: body.email ?? "",
    password: body.password ?? "",
    brandName: body.brandName ?? "",
    category: body.category ?? "",
    website: body.website ?? "",
    market: body.market,
  });

  if (!result.ok) {
    if (result.status === 409) {
      return NextResponse.json({ ok: false, error: result.error || "Email already exists", field: "email" }, { status: 409 });
    }
    if ((result.status ?? 0) >= 400 && (result.status ?? 0) < 500) {
      return NextResponse.json({ ok: false, error: result.error || "Registration failed" }, { status: result.status });
    }
    return NextResponse.json({ ok: false, error: result.error || "Registration failed" }, { status: result.status || 500 });
  }

  const user = result.data?.user || {};
  const token = await createSessionToken({
    email: user.email ?? body.email,
    name: user.name ?? user.display_name ?? body.name,
    plan: user.plan ?? "Starter",
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    backendToken: result.data?.token,
    userId: user.id,
    workspaceId: user.workspaceId,
  });
  const response = NextResponse.json({ ok: true, name: user.name ?? body.name, source: "api" });
  response.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return response;
}