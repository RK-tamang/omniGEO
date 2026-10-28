import { NextResponse } from "next/server";

const users = [
  { id: "11111111-1111-1111-1111-111111111111", email: "sarah@asterflow.example", name: "Sarah Chen", role: "Owner", plan: "pro", status: "Active", workspace_name: "AsterFlow", created_at: "2026-09-01T00:00:00Z" },
  { id: "22222222-2222-2222-2222-222222222222", email: "marcus@nova.example", name: "Marcus Ruiz", role: "Admin", plan: "starter", status: "Active", workspace_name: "Nova Labs", created_at: "2026-09-05T00:00:00Z" },
  { id: "33333333-3333-3333-3333-333333333333", email: "priya@zenith.example", name: "Priya Shah", role: "Member", plan: "enterprise", status: "Active", workspace_name: "Zenith Co", created_at: "2026-09-10T00:00:00Z" },
  { id: "44444444-4444-4444-4444-444444444444", email: "david@orbit.example", name: "David Kim", role: "Member", plan: "starter", status: "Invited", workspace_name: "Orbit Systems", created_at: "2026-09-15T00:00:00Z" },
  { id: "55555555-5555-5555-5555-555555555555", email: "elena@prism.example", name: "Elena Voss", role: "Owner", plan: "pro", status: "Active", workspace_name: "Prism Data", created_at: "2026-09-20T00:00:00Z" },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const page = users.slice(offset, offset + limit);
  return NextResponse.json({ users: page, count: page.length });
}
