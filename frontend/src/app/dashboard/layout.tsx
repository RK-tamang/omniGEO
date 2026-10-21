import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { DashboardShell } from "@/components/dashboard/shell";

export const metadata: Metadata = {
  title: {
    default: "Dashboard — OmniGEO",
    template: "%s — Dashboard · OmniGEO",
  },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/dashboard");

  return (
    <DashboardShell user={{ name: session.name, email: session.email, plan: session.plan }}>
      {children}
    </DashboardShell>
  );
}
