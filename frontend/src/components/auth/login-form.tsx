"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "signin" | "signup";

export function LoginForm({ next, initialMode = "signin" }: { next: string; initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    setLoading(true);
    try {
      const res = await fetch(isSignup ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isSignup ? { name, email, password } : { email, password }),
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
          ? "Unlock the full scan report and start tracking your prompts."
          : "Open the demo workspace for Northwind Labs."}
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
          <label className="block">
            <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">Name</span>
            <input
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aarav Mehta"
              className="w-full rounded-xl border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk placeholder:text-mist-dim outline-none transition-colors focus:border-iris/60"
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">Email</span>
          <input
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
