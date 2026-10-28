import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: any) {
  const workspace_id = params.workspace_id;
  const { searchParams } = new URL(req.url);
  const plan = searchParams.get("plan") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const body: Record<string, string> = {};
  if (plan) body.plan = plan;
  if (status) body.status = status;
  return NextResponse.json({ workspace_id, updated: true, ...body });
}
