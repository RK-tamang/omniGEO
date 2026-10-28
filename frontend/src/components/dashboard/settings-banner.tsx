"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { plans } from "@/lib/content";
import { BUSINESS_CATEGORIES } from "@/lib/business";
import { formatINR } from "@/lib/format";

type Settings = {
  brandName?: string;
  category?: string;
  workspaceName: string;
  whitelist: string[];
  timezone: string;
  locale: string;
  competitors: string;
  runDay: string;
  digest: string;
  emailDigest: boolean;
  criticalAlerts: boolean;
  productUpdates: boolean;
};

const TIMEZONES = ["Asia/Kolkata", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney"];
const LOCALES = ["en-IN", "en-US", "en-GB", "hi-IN"];
const RUN_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DIGESTS = ["Weekly", "Monthly", "Off"];

const input =
  "w-full rounded-xl border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk placeholder:text-mist-dim outline-none transition-colors focus:border-iris/60 focus:ring-1 focus:ring-iris/50";
const label = "mb-1 block text-[0.58rem] uppercase tracking-widest text-mist-dim";
const help = "mt-1 text-xs leading-relaxed text-mist-dim";

function PremiumToggle({
  checked,
  onChange,
  title,
  sub,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/50 py-3 last:border-0 last:pb-0 first:pt-0">
      <div>
        <p className="text-sm font-medium text-chalk">{title}</p>
        <p className="mt-0.5 text-[0.58rem] text-mist-dim">{sub}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-all duration-200 ${
          checked ? "border-iris/60 bg-iris/40 shadow-[0_0_0_8px_rgba(62,124,176,0.18)]" : "border-line bg-surface-2"
        }`}
      >
        <span
          className={`block size-4 rounded-full bg-chalk transition-transform duration-200 ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5 border border-line/60">
      <div className="flex items-center gap-2 mb-3">
        <span className="size-2 rounded-full border border-line bg-surface-2" />
        <h2 className="text-sm font-medium text-chalk tracking-tight">{title}</h2>
      </div>
      <p className="text-[0.58rem] text-mist-dim mb-4">{sub}</p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

const planPrice = (plan: string) => plans.find((p) => p.name === plan)?.monthly ?? 0;

export function SettingsBanner({
  open,
  onClose,
  user,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  user: { name: string; email: string };
  plan: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Settings>({
    workspaceName: "",
    whitelist: [],
    timezone: "Asia/Kolkata",
    locale: "en-IN",
    competitors: "",
    runDay: "Monday",
    digest: "Weekly",
    emailDigest: false,
    criticalAlerts: false,
    productUpdates: false,
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const set = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus("idle");
  }, []);

  async function save(payload: Record<string, unknown>) {
    setStatus("saving");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; settings?: Settings };
      if (!res.ok || !data.ok || !data.settings) {
        setStatus("error");
        return;
      }
      setForm(data.settings);
      setStatus("saved");
      window.setTimeout(() => { setStatus("idle"); onClose(); }, 1200);
    } catch {
      setStatus("error");
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void save(form);
  };

  const onReset = () => {
    void save({ reset: true });
  };

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes omni-modal-enter {
          from { opacity: 0; transform: scale(0.95) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Workspace settings">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
          onClick={onClose}
          aria-hidden
        />

        {/* Modal card */}
        <div
          className="relative w-full max-w-2xl m-6 flex flex-col"
          style={{ animation: "omni-modal-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        >
          {/* Header */}
          <div className="relative z-10 rounded-3xl border border-line bg-surface/90 backdrop-blur-xl p-5 pt-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)]">
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-3xl" style={{ background: "linear-gradient(to bottom, #3e7cb0, #39a0a8)" }} />

            <div className="relative z-10 flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-2xl border border-line bg-surface-2">
                  <svg width="20" height="20" viewBox="0 0 26 26" fill="none" aria-hidden className="text-iris">
                    <circle cx="13" cy="13" r="11.5" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="13" cy="13" r="4.5" fill="currentColor" />
                    <path d="M13 1.5v4M13 20.5v4M1.5 13h4M20.5 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">Workspace settings</p>
                  <p className="text-base font-semibold text-chalk tracking-tight">OmniGEO</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="rounded-lg p-1.5 text-mist hover:bg-surface-2 hover:text-chalk transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <path d="M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="px-5 pb-5">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full border border-line/60 bg-surface-2 text-[0.55rem] text-mist-dim uppercase tracking-widest font-mono">
                  {plan}
                </span>
              </div>
            </div>
          </div>

          {/* Form body */}
          <div className="relative z-10 rounded-3xl border-b border-line border-t-0 bg-surface/80 backdrop-blur p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] max-h-[85vh] overflow-y-auto overscroll-contain">
            <form id="settings-banner-form" onSubmit={onSubmit} className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <Section title="Account" sub="Your demo identity — read-only in this build.">
                  <div className="space-y-3.5">
                    <div>
                      <span className={label}>Name</span>
                      <input className={input} value={user.name} readOnly aria-readonly />
                    </div>
                    <div>
                      <span className={label}>Email</span>
                      <input className={input} value={user.email} readOnly aria-readonly />
                    </div>
                    <div className="flex items-center justify-between border-t border-line pt-3.5">
                      <p className="font-mono text-[0.55rem] text-mist-dim">
                        {plan} plan · {formatINR(planPrice(plan))}/mo
                      </p>
                      <Link
                        href="/pricing"
                        className="text-xs text-mist underline decoration-line-strong underline-offset-4 hover:text-chalk"
                      >
                        Change plan
                      </Link>
                    </div>
                  </div>
                </Section>

                <Section title="Business" sub="What we look for when we check the engines and build your prompts.">
                  <div className="space-y-3.5">
                    <div>
                      <label className={label} htmlFor="brandName">
                        Brand name
                      </label>
                      <input
                        id="brandName"
                        className={input}
                        value={form.brandName ?? ""}
                        onChange={(e) => set("brandName", e.target.value)}
                        placeholder="Northwind Labs"
                        maxLength={100}
                      />
                      <p className={help}>The name the engines should start mentioning.</p>
                    </div>
                    <div>
                      <label className={label} htmlFor="category">
                        Category
                      </label>
                      <select
                        id="category"
                        className={input}
                        value={form.category ?? ""}
                        onChange={(e) => set("category", e.target.value)}
                      >
                        <option value="">Not set</option>
                        {BUSINESS_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <p className={help}>Shapes which prompts and content angles we test.</p>
                    </div>
                  </div>
                </Section>

                <Section title="Workspace" sub="Shown across reports and shared with your team.">
                  <div className="space-y-3.5">
                    <div>
                      <label className={label} htmlFor="workspaceName">
                        Workspace name
                      </label>
                      <input
                        id="workspaceName"
                        className={input}
                        value={form.workspaceName}
                        onChange={(e) => set("workspaceName", e.target.value)}
                        maxLength={120}
                      />
                    </div>
                    <div>
                      <label className={label} htmlFor="domain-0">
                        Whitelisted domains
                      </label>
                      <p className={help}>
                        The tools only scan and optimise domains on this list. The first entry is your primary domain —
                        the dashboard reports on it.
                      </p>
                      <ul className="space-y-2">
                        {form.whitelist.map((domain, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <input
                              id={`domain-${i}`}
                              className={input}
                              value={domain}
                              onChange={(e) => {
                                const next = [...form.whitelist];
                                next[i] = e.target.value;
                                set("whitelist", next);
                              }}
                              placeholder="example.com"
                              maxLength={120}
                              aria-label={i === 0 ? "Primary domain" : `Whitelisted domain ${i + 1}`}
                            />
                            {i === 0 ? (
                              <span className="shrink-0 rounded-full border border-iris/40 bg-iris/10 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-chalk">
                                Primary
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => set("whitelist", form.whitelist.filter((_, j) => j !== i))}
                                className="shrink-0 rounded-lg border border-line px-2.5 py-2 text-xs text-mist transition-colors hover:border-coral/50 hover:text-coral"
                                aria-label={`Remove ${domain || "domain"}`}
                              >
                                Remove
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => set("whitelist", [...form.whitelist, ""])}
                        className="mt-2 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs text-mist transition-colors hover:border-line-strong hover:text-chalk"
                      >
                        + Add domain
                      </button>
                    </div>
                  </div>
                </Section>

                <Section title="Region & locale" sub="Controls date formats and the search locale used for rank checks.">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className={label} htmlFor="timezone">
                        Timezone
                      </label>
                      <select id="timezone" className={input} value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={label} htmlFor="locale">
                        Locale
                      </label>
                      <select id="locale" className={input} value={form.locale} onChange={(e) => set("locale", e.target.value)}>
                        {LOCALES.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </Section>

                <Section title="Tracking" sub="Prompt-set runs and the competitors we compare you against.">
                  <div className="space-y-3.5">
                    <div>
                      <label className={label} htmlFor="competitors">
                        Competitors (comma-separated)
                      </label>
                      <input
                        id="competitors"
                        className={input}
                        value={form.competitors}
                        onChange={(e) => set("competitors", e.target.value)}
                        maxLength={240}
                      />
                    </div>
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <div>
                        <label className={label} htmlFor="runDay">
                          Weekly run day
                        </label>
                        <select id="runDay" className={input} value={form.runDay} onChange={(e) => set("runDay", e.target.value)}>
                          {RUN_DAYS.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={label} htmlFor="digest">
                          Report digest
                        </label>
                        <select id="digest" className={input} value={form.digest} onChange={(e) => set("digest", e.target.value)}>
                          {DIGESTS.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </Section>
              </div>

              <Section title="Notifications" sub="What lands in your inbox and what stays in the app.">
                <PremiumToggle
                  checked={form.emailDigest}
                  onChange={(v) => set("emailDigest", v)}
                  title="Visibility digest"
                  sub="Mention rate, citations and share-of-voice changes, on your digest cadence."
                />
                <PremiumToggle
                  checked={form.criticalAlerts}
                  onChange={(v) => set("criticalAlerts", v)}
                  title="Critical audit alerts"
                  sub="Get told the moment a crawler block or schema regression drops your health score."
                />
                <PremiumToggle
                  checked={form.productUpdates}
                  onChange={(v) => set("productUpdates", v)}
                  title="Product updates"
                  sub="New engines, new checks and occasional changelog notes."
                />
              </Section>

              <Section title="Danger zone" sub="Irreversible actions for this workspace.">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-coral">Reset workspace settings</p>
                    <p className="mt-0.5 text-xs text-mist-dim">Restores tracking and notification preferences to defaults.</p>
                  </div>
                  <button
                    type="button"
                    onClick={onReset}
                    className="rounded-full border border-coral/40 px-4 py-2 text-sm font-medium text-coral transition-colors hover:bg-coral/10"
                  >
                    Reset settings
                  </button>
                </div>
                <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-chalk">Sign out of this device</p>
                    <p className="mt-0.5 text-xs text-mist-dim">Ends the session cookie immediately.</p>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    className="rounded-full border border-line px-4 py-2 text-sm font-medium text-mist transition-colors hover:border-line-strong hover:text-chalk"
                  >
                    Sign out
                  </button>
                </div>
              </Section>
            </form>
          </div>

          {/* Sticky footer */}
          <div className="relative z-10 rounded-b-3xl border-t border-line bg-surface/80 backdrop-blur px-6 py-4 flex items-center justify-between gap-4">
            <span
              className="font-mono text-[0.58rem] leading-none"
              style={{ whiteSpace: "nowrap" }}
            >
              {status === "saved" && <span className="flex items-center gap-1.5 text-mint"><span className="size-2 rounded-full bg-mint" />Saved</span>}
              {status === "saving" && <span className="flex items-center gap-1.5 text-mist-dim">Saving…</span>}
              {status === "error" && <span className="flex items-center gap-1.5 text-coral">Could not save — try again</span>}
            </span>
            <button
              type="button"
              onClick={onClose}
              disabled={status === "saving"}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-mist transition-colors hover:bg-surface-2 hover:text-chalk disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              form="settings-banner-form"
              type="submit"
              disabled={status === "saving"}
              className="rounded-full bg-gradient-to-r from-iris to-aqua px-6 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50 shadow-[0_10px_20px_-10px_rgba(62,124,176,0.5)]"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
