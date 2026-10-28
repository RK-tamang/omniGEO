import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendFetch } from "@/lib/api-client";
import { DashboardCustomizer } from "@/components/dashboard/dashboard-customizer";

export const metadata: Metadata = { title: "Customise Dashboard" };

export default async function CustomizeDashboardPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/dashboard/customize");

  const result = await backendFetch<any>("/api/dashboard/layout", {
    method: "GET",
    headers: session.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
  });

  const layout = result.ok && result.data ? result.data.layout : {};
  const workspaceName = result.ok && result.data ? result.data.workspaceName : undefined;

  return (
    <DashboardCustomizer
      initial={layout}
      workspaceName={workspaceName}
    />
  );
}
