import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendFetch } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { domain, schemas } = body;

    if (!domain || !schemas || !Array.isArray(schemas)) {
      return NextResponse.json({ error: "Domain and schemas array are required" }, { status: 400 });
    }

    const proxied = await backendFetch<{
      success: boolean;
      workerUrl?: string;
      deployedSchemas?: string[];
      error?: string;
    }>("/api/v1/schema/inject", {
      body: { domain, schemas },
      headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
    });

    if (proxied.ok) {
      return NextResponse.json({ ...proxied.data, source: "backend" });
    }

    return NextResponse.json({ error: proxied.error }, { status: proxied.status || 502 });
  } catch (error) {
    console.error("Schema Injection API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to inject schemas" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workerName = searchParams.get("worker");

    if (!workerName) {
      return NextResponse.json({ error: "Worker name is required" }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: "Worker deletion not available via proxy" });
  } catch (error) {
    console.error("Schema Worker Delete API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete worker" },
      { status: 500 }
    );
  }
}
