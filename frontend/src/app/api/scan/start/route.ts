import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/server/backend-client";
import { ensureBackendSession } from "@/server/guest-session";

export const dynamic = "force-dynamic";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/**
 * Start a real scan.
 *
 * The backend owns the engine, so this route makes sure there is a tenant to
 * run against, records the domain on the workspace, and queues the audit and
 * visibility scans. The client then polls `/api/scans/:id` until they finish.
 */
export async function POST(request: NextRequest) {
  let body: { domain?: string; prompts?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const domain = (body.domain ?? "").trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (!DOMAIN_RE.test(domain)) {
    return NextResponse.json({ ok: false, error: "Enter a domain like example.com" }, { status: 400 });
  }

  const session = await ensureBackendSession();
  if (!session.ok || !session.backendToken) {
    return NextResponse.json({ ok: false, error: session.error }, { status: session.status || 503 });
  }
  const token = session.backendToken;

  // Record the domain on the workspace, but only if it is not already there.
  const existing = await backendFetch<{ domains?: Array<{ domain: string }> }>("/api/workspace/data", {
    method: "GET",
    token,
  });
  const known = existing.ok ? (existing.data?.domains ?? []) : [];
  if (!known.some((d) => d.domain?.toLowerCase() === domain.toLowerCase())) {
    await backendFetch("/api/domains", { method: "POST", body: { domain, isPrimary: true }, token });
  }

  const [audit, visibility] = await Promise.all([
    backendFetch<{ scanId: string }>("/api/scans/audit", {
      method: "POST",
      // "deep" follows a few internal links, so the report can show a real
      // page sample rather than just the homepage.
      body: { domain, depth: "deep" },
      token,
    }),
    backendFetch<{ scanId: string }>("/api/scans/visibility", {
      method: "POST",
      body: { domain, ...(body.prompts?.length ? { prompts: body.prompts } : {}) },
      token,
    }),
  ]);

  if (!audit.ok && !visibility.ok) {
    return NextResponse.json(
      { ok: false, error: audit.error || visibility.error || "Could not start the scan." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    domain,
    scans: {
      audit: audit.ok ? audit.data?.scanId : null,
      visibility: visibility.ok ? visibility.data?.scanId : null,
    },
  });
}
