"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SCAN_STEPS } from "@/lib/scan-data";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

type ScanState = "idle" | "starting" | "running" | "done" | "error";

export function ScanRunner() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ScanState>("idle");
  const [step, setStep] = useState(-1); // -1 idle, 0..n-1 running, n done

  const running = state === "starting" || state === "running";

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const clean = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!DOMAIN_RE.test(clean)) {
      setError("Enter a domain like example.com");
      return;
    }
    setError(null);
    setState("starting");
    setStep(0);

    try {
      const res = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: clean }),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error ?? "Could not start the scan.");
      }

      const scanIds: string[] = [body?.scans?.visibility, body?.scans?.audit].filter(Boolean);
      if (scanIds.length === 0) throw new Error("The scan engine did not return a scan id.");

      setState("running");
      await waitForScans(scanIds, clean);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the scan.");
      setState("error");
      setStep(-1);
    }
  }

  /**
   * Poll the backend until every queued scan finishes, then open the report.
   * The audit and visibility scans run in parallel, so both have to land
   * before the report has anything to show.
   */
  async function waitForScans(scanIds: string[], clean: string) {
    const started = Date.now();
    const timeout = 180_000;
    const pending = new Set(scanIds);

    for (;;) {
      if (Date.now() - started > timeout) {
        throw new Error("The scan is taking too long. Try again in a moment.");
      }

      for (const id of [...pending]) {
        const res = await fetch(`/api/scans/${encodeURIComponent(id)}`, { cache: "no-store" });
        const body = await res.json();
        const status = body?.scan?.status ?? body?.status;

        if (status === "completed") {
          pending.delete(id);
        } else if (status === "failed") {
          throw new Error(body?.scan?.error ?? body?.error ?? "The scan failed.");
        }
      }

      if (pending.size === 0) {
        setStep(SCAN_STEPS.length);
        setState("done");
        router.push(`/scan/${scanIds[0]}?d=${encodeURIComponent(clean)}`);
        return;
      }

      // Walk the step list while the engine works.
      const elapsed = Date.now() - started;
      const next = Math.min(SCAN_STEPS.length - 1, Math.floor(elapsed / 6000));
      setStep(next);

      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
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

      {(running || state === "done") && (
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
