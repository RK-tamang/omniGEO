import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/api-client";

export const dynamic = "force-dynamic";

type ContactPayload = {
  intent?: string;
  name?: string;
  email?: string;
  company?: string;
  website?: string;
  teamSize?: string;
  budget?: string;
  message?: string;
};

export async function POST(request: Request) {
  let body: ContactPayload;
  try {
    body = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // Minimal validation — the backend can take over from here.
  if (!body?.name || !body?.email || !body?.company) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  const payload = {
    intent: String(body.intent ?? "general"),
    name: String(body.name),
    email: String(body.email),
    company: String(body.company),
    website: body.website ? String(body.website) : undefined,
    teamSize: body.teamSize ? String(body.teamSize) : undefined,
    budget: body.budget ? String(body.budget) : undefined,
    message: body.message ? String(body.message) : undefined,
  };

  try {
    const result = await backendFetch<{ success: boolean; id?: string }>("/api/v1/contact", {
      method: "POST",
      body: payload,
    });
    if (result.ok) {
      return NextResponse.json({ ok: true, id: result.data?.id, source: "api" });
    }
    if (result.status && result.status >= 400 && result.status < 500) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }
  } catch (e) {
    // fall through
  }

  return NextResponse.json({ ok: false, error: "Contact submission failed" }, { status: 502 });
}
