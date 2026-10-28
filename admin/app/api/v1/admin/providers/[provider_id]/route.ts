import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: any) {
  const provider_id = params.provider_id;
  const { searchParams } = new URL(req.url);
  const enabled = searchParams.get("enabled") ?? undefined;
  const max_concurrency = searchParams.get("max_concurrency") ?? undefined;
  const max_requests_per_minute = searchParams.get("max_requests_per_minute") ?? undefined;
  const body: Record<string, string> = {};
  if (enabled) body.enabled = enabled;
  if (max_concurrency) body.max_concurrency = max_concurrency;
  if (max_requests_per_minute) body.max_requests_per_minute = max_requests_per_minute;
  return NextResponse.json({ provider_id, updated: true, ...body });
}
