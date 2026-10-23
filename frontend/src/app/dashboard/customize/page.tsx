import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { resolveDashboardLayout, resolveSettings } from "@/server/settings";
import { DashboardCustomizer } from "@/components/dashboard/dashboard-customizer";

export const metadata: Metadata = { title: "Customise Dashboard" };

export default async function CustomizeDashboardPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/dashboard/customize");

  const [settings, layout] = await Promise.all([
    resolveSettings(session),
    resolveDashboardLayout(session),
  ]);

  return (
    <DashboardCustomizer
      initial={layout}
      workspaceName={settings.workspaceName}
    />
  );
}
