import { NextRequest, NextResponse } from "next/server";
import { getCloudflareWorkersClient } from "@/server/services/cloudflare";
import { getAuthUser } from "@/server/auth";

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

    const client = getCloudflareWorkersClient();
    const result = await client.injectSchemas({ domain, schemas });

    return NextResponse.json({
      success: result.success,
      workerUrl: result.workerUrl,
      deployedSchemas: result.deployedSchemas,
      error: result.error,
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