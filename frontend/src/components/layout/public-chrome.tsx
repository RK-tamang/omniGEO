"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

const HIDDEN_ON = ["/dashboard", "/login"];

/** Public marketing chrome — hidden inside the dashboard and login experiences. */
export function PublicChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hidden = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (hidden) {
    return (
      <main id="main" className="min-h-screen">
        {children}
      </main>
    );
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="min-h-screen pt-16">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
