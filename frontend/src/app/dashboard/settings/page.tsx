import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { DashboardHeader } from "@/components/dashboard/panel";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { getSettings } from "@/server/db";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/dashboard/settings");

  return (
    <>
      <DashboardHeader
        title="Settings"
        sub="Workspace, tracking and notification preferences for this demo workspace. Changes persist to the local data store."
      />
      <SettingsForm
        initial={getSettings()}
        profile={{ name: session.name, email: session.email, plan: session.plan }}
      />
    </>
  );
}
