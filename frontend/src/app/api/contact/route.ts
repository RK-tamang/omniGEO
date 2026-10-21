import { NextResponse } from "next/server";
import { saveContact } from "@/server/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Minimal validation — the backend can take over from here.
    if (!body?.name || !body?.email || !body?.company) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    // Persist to the JSON store (the start of the real backend) and log in dev.
    const record = saveContact({
      intent: String(body.intent ?? "general"),
      name: String(body.name),
      email: String(body.email),
      company: String(body.company),
      website: body.website ? String(body.website) : undefined,
      teamSize: body.teamSize ? String(body.teamSize) : undefined,
      budget: body.budget ? String(body.budget) : undefined,
      message: body.message ? String(body.message) : undefined,
    });
    console.log("[contact] saved", record);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
