import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { resolveDashboardLayout, resolveSettings } from "@/server/settings";
import { DashboardHome } from "@/components/dashboard/dashboard-home";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/dashboard");

  const [settings, layout] = await Promise.all([
    resolveSettings(session),
    resolveDashboardLayout(session),
  ]);

  return (
    <DashboardHome
      user={{ name: session.name, plan: session.plan }}
      workspaceName={settings.workspaceName}
      layout={layout}
    />
  );
}
