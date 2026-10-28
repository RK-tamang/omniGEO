import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { DashboardShell } from "@/components/dashboard/shell";
import api from "@/lib/api-client";

export const metadata: Metadata = {
  title: {
    default: "Dashboard — OmniGEO",
    template: "%s — Dashboard — OmniGEO",
  },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/dashboard");

  const data = await api.getWorkspaces();

  return (
    <DashboardShell
      user={{ name: session.email, email: session.email, plan: session.plan }}
      workspace={{
        name: "Workspace",
        plan: session.plan || "Starter",
        prompts: 0,
        domain: undefined,
        category: undefined,
      }}
    >
      {children}
    </DashboardShell>
  );
}