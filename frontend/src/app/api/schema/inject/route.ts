import { NextRequest, NextResponse } from "next/server";
import { getCloudflareWorkersClient } from "@/server/services/cloudflare";
import { getAuthUser } from "@/server/auth";
import { backendEnabled, backendFetch } from "@/server/backend-client";
import { getAuthUserWithBackendToken } from "@/server/auth-backend";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { domain, schemas } = body;

    if (!domain || !schemas || !Array.isArray(schemas)) {
      return NextResponse.json({ error: "Domain and schemas array are required" }, { status: 400 });
    }

    // Only Enterprise plan can deploy custom schema workers
    if (user.plan !== "Enterprise") {
      return NextResponse.json(
        { error: "Schema injection requires Enterprise plan" },
        { status: 403 }
      );
    }

    // 1. Prefer the backend, which owns the deployment and its record of it.
    if (backendEnabled()) {
      const { backendToken } = await getAuthUserWithBackendToken();
      const proxied = await backendFetch<{
        success: boolean;
        workerUrl?: string;
        deployedSchemas?: string[];
        error?: string;
      }>("/api/schema/inject", {
        body: { domain, schemas },
        token: backendToken ?? undefined,
      });

      if (proxied.ok) {
        return NextResponse.json({ ...proxied.data, source: "backend" });
      }
      if (proxied.status >= 400 && proxied.status < 500) {
        return NextResponse.json({ error: proxied.error }, { status: proxied.status });
      }
    }

    // 2. Local fallback — deploy the worker directly.
    const client = getCloudflareWorkersClient();
    const result = await client.injectSchemas({ domain, schemas });

    return NextResponse.json({
      success: result.success,
      workerUrl: result.workerUrl,
      deployedSchemas: result.deployedSchemas,
      error: result.error,
      source: "local",
    });
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
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workerName = searchParams.get("worker");

    if (!workerName) {
      return NextResponse.json({ error: "Worker name is required" }, { status: 400 });
    }

    const client = getCloudflareWorkersClient();
    const deleted = await client.deleteWorker(workerName);

    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error("Schema Worker Delete API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete worker" },
      { status: 500 }
    );
  }
}