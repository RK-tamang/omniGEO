import { NextResponse } from "next/server";

const settings = [
  { key: "session_timeout_minutes", value: 480, updated_at: "2026-09-01T00:00:00Z" },
  { key: "max_concurrent_scans", value: 5, updated_at: "2026-09-01T00:00:00Z" },
  { key: "email_notifications_enabled", value: true, updated_at: "2026-09-05T00:00:00Z" },
  { key: "rate_limit_per_minute", value: 100, updated_at: "2026-09-10T00:00:00Z" },
  { key: "report_retention_days", value: 90, updated_at: "2026-09-15T00:00:00Z" },
];

export async function GET() {
  return NextResponse.json({ settings });
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key") ?? "";
  const value = searchParams.get("value") ?? "";
  return NextResponse.json({ key, upserted: true, value });
}
