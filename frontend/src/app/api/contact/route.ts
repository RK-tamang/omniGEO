import { NextResponse } from "next/server";
import { saveContact } from "@/server/db";
import { backendEnabled, backendFetch } from "@/server/backend-client";

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

  // Prefer the backend so enquiries are stored with the rest of the data.
  // Contact requests are unauthenticated, so no session is required.
  if (backendEnabled()) {
    const result = await backendFetch<{ success: boolean; id?: string }>("/api/contact", {
      method: "POST",
      body: payload,
    });
    if (result.ok) {
      return NextResponse.json({ ok: true, id: result.data?.id, source: "backend" });
    }
    // A 4xx is a validation problem the caller should see; anything else
    // (backend down) falls through to the local store.
    if (result.status >= 400 && result.status < 500) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }
  }

  // Persist to the JSON store (the start of the real backend) and log in dev.
  const record = saveContact(payload);
  console.log("[contact] saved", record);

  return NextResponse.json({ ok: true, source: "local" });
}
