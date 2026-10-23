import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath, SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your OmniGEO demo workspace.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; intent?: string }>;
}) {
  const { next, intent } = await searchParams;

  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (session) redirect("/dashboard");

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="aurora -left-24 top-1/3 size-[480px] bg-iris/14" aria-hidden />

        <Link href="/" className="relative font-display text-2xl italic text-chalk">
          OmniGEO
        </Link>

        <div className="relative max-w-md">
          <p className="kicker mb-4">
            <span className="size-1 rounded-full bg-iris" />
            Demo workspace
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-chalk">
            See what AI says about <span className="font-display font-normal italic text-gradient">your brand.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-mist">
            The demo workspace is a real, working workspace for a sample site — every number you see comes from the
            scans it has actually run.
          </p>

          <dl className="mt-8 grid grid-cols-3 gap-3">
            {[
              { label: "Engines tracked", value: "4" },
              { label: "Tools in suite", value: "75" },
              { label: "Source of truth", value: "1" },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl p-4">
                <dt className="font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim">{s.label}</dt>
                <dd className="mt-1.5 font-display text-2xl font-normal italic text-chalk">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative font-mono text-[0.62rem] text-mist-dim">
          Be the brand AI recommends.
        </p>
      </section>

      {/* Form panel */}
      <section className="relative flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 inline-block font-display text-2xl italic text-chalk lg:hidden">
            OmniGEO
          </Link>
          <LoginForm next={safeNextPath(next)} initialMode={intent === "signup" ? "signup" : "signin"} />
          <p className="mt-8 text-center font-mono text-[0.62rem] leading-relaxed text-mist-dim">
            Demo build — accounts are stored in a local JSON file and sessions in an HMAC-signed cookie.
          </p>
        </div>
      </section>
    </div>
  );
}
