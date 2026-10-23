"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BUSINESS_CATEGORIES,
  MARKETS,
  isValidWebsite,
  normalizeWebsite,
} from "@/lib/business";

type Mode = "signin" | "signup";

export function LoginForm({ next, initialMode = "signin" }: { next: string; initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState<string>(BUSINESS_CATEGORIES[0].value);
  const [website, setWebsite] = useState("");
  const [market, setMarket] = useState<string>(MARKETS[0].value);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isSignup) {
      if (!brandName.trim()) {
        setError("Tell us your brand name.");
        return;
      }
      if (!isValidWebsite(website)) {
        setError("Enter your website, like example.com.");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(isSignup ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSignup
            ? {
                name,
                email,
                password,
                brandName: brandName.trim(),
                category,
                website: normalizeWebsite(website),
                market,
              }
            : { email, password },
        ),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setMode("signin");
    setEmail("demo@omnigeo.ai");
    setPassword("demo1234");
    setError(null);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-chalk">
        {isSignup ? "Create your free account" : "Sign in"}
      </h1>
      <p className="mt-2 text-sm text-mist">
        {isSignup
          ? "Tell us about the business and we set up the workspace around it."
          : "Open the demo workspace for testing.com."}
      </p>

      <div
        role="tablist"
        aria-label="Sign in or create an account"
        className="mt-7 grid grid-cols-2 gap-1 rounded-full border border-line bg-surface-1 p-1"
      >
        {(
          [
            { id: "signin", label: "Sign in" },
            { id: "signup", label: "Create account" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`authtab-${t.id}`}
            aria-selected={mode === t.id}
            aria-controls="auth-panel"
            onClick={() => switchMode(t.id)}
            className={`rounded-full px-4 py-2 text-sm transition-colors ${
              mode === t.id ? "bg-surface-3 font-medium text-chalk" : "text-mist hover:text-chalk"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        id="auth-panel"
        role="tabpanel"
        aria-labelledby={`authtab-${mode}`}
        onSubmit={submit}
        className="mt-6 space-y-4"
        noValidate
      >
        {isSignup && (
          <>
            <label className="block">
              <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">
                Your name
              </span>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aarav Mehta"
                className="w-full rounded-xl border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk placeholder:text-mist-dim outline-none transition-colors focus:border-iris/60"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">
                Brand name
              </span>
              <input
                id="brandName"
                type="text"
                required
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Northwind Labs"
                className="w-full rounded-xl border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk placeholder:text-mist-dim outline-none transition-colors focus:border-iris/60"
              />
              <span className="mt-1.5 block text-xs text-mist-dim">
                The brand the engines should start mentioning.
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">
                Category
              </span>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk outline-none transition-colors focus:border-iris/60"
              >
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-xs text-mist-dim">
                Shapes which prompts and content angles we test.
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">
                Website
              </span>
              <input
                id="website"
                type="text"
                inputMode="url"
                required
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="yourdomain.com"
                className="w-full rounded-xl border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk placeholder:text-mist-dim outline-none transition-colors focus:border-iris/60"
              />
              <span className="mt-1.5 block text-xs text-mist-dim">
                The domain we track, audit and check for AI crawler access.
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">
                Primary market
              </span>
              <select
                id="market"
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk outline-none transition-colors focus:border-iris/60"
              >
                {MARKETS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-xs text-mist-dim">
                Where your buyers are — sets the locale for every report.
              </span>
            </label>
          </>
        )}

        <label className="block">
          <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">Email</span>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-xl border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk placeholder:text-mist-dim outline-none transition-colors focus:border-iris/60"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">Password</span>
          <input
            id="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignup ? "At least 8 characters" : "••••••••"}
            className="w-full rounded-xl border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk placeholder:text-mist-dim outline-none transition-colors focus:border-iris/60"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-2.5 text-sm text-coral">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-gradient-to-r from-iris to-aqua px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (isSignup ? "Creating account…" : "Signing in…") : isSignup ? "Create free account" : "Sign in"}
        </button>
      </form>

      {isSignup ? (
        <p className="mt-5 text-center font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
          Free forever · no credit card
        </p>
      ) : (
        <div className="mt-6 rounded-2xl border border-line bg-surface-1 p-4">
          <p className="font-mono text-[0.58rem] uppercase tracking-widest text-iris">Try the demo account</p>
          <p className="mt-2 font-mono text-xs text-mist">demo@omnigeo.ai · demo1234</p>
          <button
            type="button"
            onClick={fillDemo}
            className="mt-3 w-full rounded-full border border-line px-4 py-2 text-sm text-mist transition-colors hover:border-line-strong hover:text-chalk"
          >
            Use demo credentials
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-mist-dim">
        <Link href="/" className="underline decoration-line-strong underline-offset-4 hover:text-chalk">
          ← Back to site
        </Link>
      </p>
    </div>
  );
}
