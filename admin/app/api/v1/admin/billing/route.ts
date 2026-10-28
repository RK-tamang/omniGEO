import { NextResponse } from "next/server";

const billing = [
  { organization_id: "org-11111111-1111-1111-1111-111111111111", plan: "pro", monthly_revenue_microusd: 79000000, status: "active", updated_at: "2026-10-01T00:00:00Z" },
  { organization_id: "org-22222222-2222-2222-2222-222222222222", plan: "starter", monthly_revenue_microusd: 29000000, status: "active", updated_at: "2026-10-05T00:00:00Z" },
  { organization_id: "org-33333333-3333-3333-3333-333333333333", plan: "enterprise", monthly_revenue_microusd: 199000000, status: "active", updated_at: "2026-10-15T00:00:00Z" },
  { organization_id: "org-44444444-4444-4444-4444-444444444444", plan: "starter", monthly_revenue_microusd: 29000000, status: "past_due", updated_at: "2026-10-20T00:00:00Z" },
  { organization_id: "org-55555555-5555-5555-5555-555555555555", plan: "pro", monthly_revenue_microusd: 79000000, status: "active", updated_at: "2026-09-25T00:00:00Z" },
];

export async function GET() {
  const total = billing.reduce((acc, b) => acc + (b.monthly_revenue_microusd ?? 0), 0);
  return NextResponse.json({ billing, total_monthly_microusd: total });
}
