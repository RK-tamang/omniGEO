import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: any) {
  const user_id = params.user_id;
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") ?? undefined;
  const plan = searchParams.get("plan") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const body: Record<string, string> = {};
  if (role) body.role = role;
  if (plan) body.plan = plan;
  if (status) body.status = status;
  return NextResponse.json({ user_id, updated: true, ...body });
}
