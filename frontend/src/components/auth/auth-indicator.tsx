"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Shows "Sign in" or "Dashboard" depending on the session cookie. Fetches lazily so static pages stay static. */
export function AuthIndicator({ className = "" }: { className?: string }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setSignedIn(Boolean(d?.user)))
      .catch(() => alive && setSignedIn(false));
    return () => {
      alive = false;
    };
  }, []);

  if (signedIn === null) return null;

  return (
    <Link
      href={signedIn ? "/dashboard" : "/login"}
      className={`rounded-full px-3.5 py-2 text-sm text-mist transition-colors hover:text-chalk ${className}`}
    >
      {signedIn ? "Dashboard" : "Sign in"}
    </Link>
  );
}
