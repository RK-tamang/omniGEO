import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { DashboardHeader } from "@/components/dashboard/panel";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { resolveSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/dashboard/settings");

  // Read from the same place the save goes to — otherwise a saved change
  // looks lost on reload when a backend is configured.
  const settings = await resolveSettings(session);

  return (
    <>
      <DashboardHeader
        title="Settings"
        sub="Workspace, tracking and notification preferences for this workspace. Changes persist to the OmniGEO backend."
      />
      <SettingsForm
        initial={settings}
        profile={{ name: session.name, email: session.email, plan: session.plan }}
      />
    </>
  );
}
