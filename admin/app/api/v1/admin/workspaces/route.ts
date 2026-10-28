import { NextResponse } from "next/server";

const workspaces = [
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "AsterFlow", domain: "asterflow.example", plan: "pro", user_count: 4, status: "Active", scans: 120, created_at: "2026-08-01T00:00:00Z" },
  { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "Nova Labs", domain: "nova.example", plan: "starter", user_count: 2, status: "Active", scans: 45, created_at: "2026-08-05T00:00:00Z" },
  { id: "cccccccc-cccc-cccc-cccc-cccccccccccc", name: "Zenith Co", domain: "zenith.example", plan: "enterprise", user_count: 12, status: "Active", scans: 410, created_at: "2026-08-10T00:00:00Z" },
  { id: "dddddddd-dddd-dddd-dddd-dddddddddddd", name: "Orbit Systems", domain: "orbit.example", plan: "starter", user_count: 3, status: "Paused", scans: 60, created_at: "2026-08-15T00:00:00Z" },
  { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", name: "Prism Data", domain: "prism.example", plan: "pro", user_count: 6, status: "Active", scans: 210, created_at: "2026-08-20T00:00:00Z" },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const page = workspaces.slice(offset, offset + limit);
  return NextResponse.json({ workspaces: page, count: page.length });
}
