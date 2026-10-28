import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { safeNextPath } from "@/lib/api-client";
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

          <div className="mt-8">
            <a
              href="/api/auth/workos?next={encodeURIComponent(safeNextPath(next))}"
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-1 px-4 py-3 text-sm font-medium text-mist transition-colors hover:border-iris/60 hover:text-iris"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              Continue with WorkOS
            </a>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <a
                href="/api/auth/workos?provider=google&next={encodeURIComponent(safeNextPath(next))}"
                className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-1 px-3 py-2.5 text-xs font-medium text-mist transition-colors hover:border-iris/60 hover:text-iris sm:text-sm sm:px-4 sm:py-3"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66v-1.83c-1.38 1.3-3.21 2.14-5.26 2.14-4.14 0-7.5-2.83-7.5-6.32 0-3.47 3.36-6.31 7.5-6.31 1.71 0 3.14.53 4.26 1.43l1.57-1.94c-1.66-1.22-3.63-1.9-5.83-1.9-5.2 0-9.09 3.81-9.09 8.29 0 4.49 3.89 8.28 9.09 8.28 1.25 0 2.45-.23 3.51-.69v1.87c-1.52.85-3.39 1.39-5.57 1.39z"/>
                  <path d="M12 5.38c1.81 0 3.28 1.35 3.28 3.01s-1.47 3.01-3.28 3.01-3.28-1.35-3.28-3.01 1.47-3.01 3.28-3.01z"/>
                </svg>
                Google
              </a>
              <a
                href="/api/auth/workos?provider=apple&next={encodeURIComponent(safeNextPath(next))}"
                className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-1 px-3 py-2.5 text-xs font-medium text-mist transition-colors hover:border-iris/60 hover:text-iris sm:text-sm sm:px-4 sm:py-3"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M10.9 3.4c-1.4 0-2.6.7-3.4 1.9-.6 1-1.1 2.2-1.4 3.6h-.1c-2.6-.2-4.6 2-4.8 4.8 0 0 .1-.1.1-.1-.2 2 .7 4.1 3 5.3v-.1c2-1.2 3.2-3.4 3.2-5.7 0-1.8-.6-3.3-1.4-4.6M13.1 3.4c-1.4 0-2.6.7-3.4 1.9-.6 1-1.1 2.2-1.4 3.6h-.1c-2.6-.2-4.6 2-4.8 4.8 0 0 .1-.1.1-.1-.2 2 .7 4.1 3 5.3v-.1c2-1.2 3.2-3.4 3.2-5.7 0-1.8-.6-3.3-1.4-4.6m-2.2 7c-1.5-.1-2.8-1-3.1-2.5-.4-2 .7-3.9 2.6-4.7 1-.4 2-.5 2.9-.2 1 .5 1.7 1.5 1.7 2.6 0 .9-.5 1.8-1.3 2.4-.6.6-1.3.9-2.1 1-.8.2-1.7.1-2.4-.2-.7-.3-1.3-.9-1.7-1.8-.2-.5-.4-1.1-.4-1.7 0-.5 0-1 .1-1.5.1-1.5.4-3 1.6-3.9 1.1-.8 2.5-1.3 4-1.3 1.5 0 2.9.6 3.9 1.6.2.1.2.3.2.4 0 .5-.2 1-.6 1.4-.5.4-1.2.7-2 .9-.6.1-1.2.1-1.7.1m7.9-7c-1.4 0-2.6.7-3.4 1.9-.6 1-1.1 2.2-1.4 3.6h-.1c-2.6-.2-4.6 2-4.8 4.8 0 0 .1-.1.1-.1-.2 2 .7 4.1 3 5.3v-.1c2-1.2 3.2-3.4 3.2-5.7 0-1.8-.6-3.3-1.4-4.6m-2.2 7c-1.5-.1-2.8-1-3.1-2.5-.4-2 .7-3.9 2.6-4.7 1-.4 2-.5 2.9-.2 1 .5 1.7 1.5 1.7 2.6 0 .9-.5 1.8-1.3 2.4-.6.6-1.3.9-2.1 1-.8.2-1.7.1-2.4-.2-.7-.3-1.3-.9-1.7-1.8-.2-.5-.4-1.1-.4-1.7 0-.5 0-1 .1-1.5.1-1.5.4-3 1.6-3.9 1.1-.8 2.5-1.3 4-1.3 1.5 0 2.9.6 3.9 1.6.2.1.2.3.2.4 0 .5-.2 1-.6 1.4-.5.4-1.2.7-2 .9-.6.1-1.2.1-1.7.1M21.2 14.2c-1.4 0-2.6.7-3.4 1.9-.6 1-1.1 2.2-1.4 3.6h-.1c-2.6-.2-4.6 2-4.8 4.8 0 0 .1-.1.1-.1-.2 2 .7 4.1 3 5.3v-.1c2-1.2 3.2-3.4 3.2-5.7 0-1.8-.6-3.3-1.4-4.6m-2.2 7c-1.5-.1-2.8-1-3.1-2.5-.4-2 .7-3.9 2.6-4.7 1-.4 2-.5 2.9-.2 1 .5 1.7 1.5 1.7 2.6 0 .9-.5 1.8-1.3 2.4-.6.6-1.3.9-2.1 1-.8.2-1.7.1-2.4-.2-.7-.3-1.3-.9-1.7-1.8-.2-.5-.4-1.1-.4-1.7 0-.5 0-1 .1-1.5.1-1.5.4-3 1.6-3.9 1.1-.8 2.5-1.3 4-1.3 1.5 0 2.9.6 3.9 1.6.2.1.2.3.2.4 0 .5-.2 1-.6 1.4-.5.4-1.2.7-2 .9-.6.1-1.2.1-1.7.1"/>
                </svg>
                Apple
              </a>
              <a
                href="/api/auth/workos?provider=gmail&next={encodeURIComponent(safeNextPath(next))}"
                className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-1 px-3 py-2.5 text-xs font-medium text-mist transition-colors hover:border-iris/60 hover:text-iris sm:text-sm sm:px-4 sm:py-3"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M22 12c0-4.42-3.58-8-8-8-1.53 0-2.93.29-4.25.77l3.56 4.01c.18.21.29.49.29.81 0 .32-.11.6-.29.84l-3.55 3.99c-.18.2-.44.32-.71.32-.27 0-.54-.13-.71-.32l-3.55-3.99c-.18-.2-.29-.5-.29-.84 0-.32.11-.6.29-.81l3.56-4.01c-1.32-.48-2.72-.77-4.25-.77-4.42 0-8 3.58-8 8 0 1.19.2 2.33.56 3.41l4.23-2.75c.1-.06.21-.17.31-.28.2-.24.49-.39.8-.39.31 0 .6.15.8.39.1.11.21.22.31.28l4.23 2.75c.36-1.08.57-2.22.57-3.41zm-8.91 3.37c-.29 0-.56-.1-.76-.28l-2.39-2.66c-.12-.13-.19-.31-.19-.5s.07-.37.19-.5l2.39-2.66c.2-.18.47-.28.76-.28s.56.1.76.28l2.39 2.66c.12.13.19.31.19.5s-.07.37-.19.5l-2.39 2.66c-.2.18-.47.28-.76.28z"/>
                </svg>
                Gmail
              </a>
            </div>
          </div>
          <p className="mt-8 text-center font-mono text-[0.62rem] leading-relaxed text-mist-dim">
            Demo build — accounts are stored in a local JSON file and sessions in an HMAC-signed cookie.
          </p>
        </div>
      </section>
    </div>
  );
}
