"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SCAN_STEPS } from "@/lib/scan-data";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export function ScanRunner() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(-1); // -1 idle, 0..n-1 running, n done

  const running = step >= 0 && step < SCAN_STEPS.length;

  function start(e: React.FormEvent) {
    e.preventDefault();
    const clean = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!DOMAIN_RE.test(clean)) {
      setError("Enter a domain like example.com");
      return;
    }
    setError(null);
    setStep(0);

    const started = Date.now();
    let i = 0;
    const tick = () => {
      i += 1;
      if (i >= SCAN_STEPS.length) {
        const id = `scan-${started.toString(36)}`;
        setStep(SCAN_STEPS.length);
        router.push(`/scan/${id}?d=${encodeURIComponent(clean)}`);
        return;
      }
      setStep(i);
      window.setTimeout(tick, 420 + Math.random() * 280);
    };
    window.setTimeout(tick, 450);
  }

  return (
    <div className="w-full">
      <form onSubmit={start} className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Your domain</span>
          <input
            type="text"
            inputMode="url"
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              setError(null);
            }}
            placeholder="yourdomain.com"
            disabled={running}
            className="w-full rounded-full border border-line bg-surface-2 px-6 py-4 text-base text-chalk placeholder:text-mist-dim outline-none transition-colors focus:border-iris/60 disabled:opacity-60"
          />
        </label>
        <button
          type="submit"
          disabled={running}
          className="shrink-0 rounded-full bg-gradient-to-r from-iris to-aqua px-8 py-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {running ? "Scanning…" : "Run free scan"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-coral">
          {error}
        </p>
      )}

      {(running || step >= SCAN_STEPS.length) && (
        <ol className="mt-8 space-y-2.5" aria-live="polite">
          {SCAN_STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                    done ? "border-mint/60 bg-mint/15 text-mint" : active ? "border-iris/60 bg-iris/15 text-iris" : "border-line text-mist-dim"
                  }`}
                  aria-hidden
                >
                  {done ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : active ? (
                    <span className="size-1.5 animate-ping rounded-full bg-iris" />
                  ) : (
                    <span className="size-1 rounded-full bg-current" />
                  )}
                </span>
                <span className={done ? "text-mist" : active ? "text-chalk" : "text-mist-dim"}>{s}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
