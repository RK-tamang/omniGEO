"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Settings } from "@/server/db";
import { plans } from "@/lib/content";
import { formatINR } from "@/lib/format";

const planPrice = (plan: string) => plans.find((p) => p.name === plan)?.monthly ?? 0;

const TIMEZONES = ["Asia/Kolkata", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney"];
const LOCALES = ["en-IN", "en-US", "en-GB", "hi-IN"];
const RUN_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DIGESTS = ["Weekly", "Monthly", "Off"];

const input =
  "w-full rounded-xl border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk placeholder:text-mist-dim outline-none transition-colors focus:border-iris/60";
const label = "mb-1.5 block font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim";

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="text-sm font-medium text-chalk">{title}</h2>
      <p className="mt-1 text-xs text-mist-dim">{sub}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Toggle({
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
    <div className="flex items-start justify-between gap-4 border-b border-line py-3.5 last:border-0 last:pb-0 first:pt-0">
      <div>
        <p className="text-sm text-chalk">{title}</p>
        <p className="mt-0.5 text-xs text-mist-dim">{sub}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked ? "border-iris/60 bg-iris/40" : "border-line bg-surface-2"
        }`}
      >
        <span
          className={`block size-4 rounded-full bg-chalk transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
}

export function SettingsForm({ initial, profile }: { initial: Settings; profile: { name: string; email: string; plan: string } }) {
  const router = useRouter();
  const [form, setForm] = useState<Settings>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus("idle");
  };

  async function save(payload: Record<string, unknown>, nextStatus: "saved" | "idle" = "saved") {
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
      if (nextStatus === "saved") {
        setStatus("saved");
        window.setTimeout(() => setStatus("idle"), 2500);
      }
    } catch {
      setStatus("error");
    }
  }

  const onSave = (e: React.FormEvent) => {
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

  return (
    <form onSubmit={onSave} className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Account" sub="Your demo identity — read-only in this build.">
          <div className="space-y-3.5">
            <div>
              <span className={label}>Name</span>
              <input className={input} value={profile.name} readOnly aria-readonly />
            </div>
            <div>
              <span className={label}>Email</span>
              <input className={input} value={profile.email} readOnly aria-readonly />
            </div>
            <div className="flex items-center justify-between border-t border-line pt-4">
              <p className="font-mono text-xs text-mist">
                {profile.plan} plan · {formatINR(planPrice(profile.plan))}/mo
              </p>
              <Link
                href="/pricing"
                className="text-sm text-mist underline decoration-line-strong underline-offset-4 hover:text-chalk"
              >
                Change plan
              </Link>
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
              <p className="mb-2 text-xs leading-relaxed text-mist-dim">
                The tools only scan and optimise domains on this list. The first entry is your primary domain — the
                dashboard reports on it.
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
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="locale">
                Locale
              </label>
              <select id="locale" className={input} value={form.locale} onChange={(e) => set("locale", e.target.value)}>
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
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
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="digest">
                  Report digest
                </label>
                <select id="digest" className={input} value={form.digest} onChange={(e) => set("digest", e.target.value)}>
                  {DIGESTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <Section title="Notifications" sub="What lands in your inbox and what stays in the app.">
        <Toggle
          checked={form.emailDigest}
          onChange={(v) => set("emailDigest", v)}
          title="Visibility digest"
          sub="Mention rate, citations and share-of-voice changes, on your digest cadence."
        />
        <Toggle
          checked={form.criticalAlerts}
          onChange={(v) => set("criticalAlerts", v)}
          title="Critical audit alerts"
          sub="Get told the moment a crawler block or schema regression drops your health score."
        />
        <Toggle
          checked={form.productUpdates}
          onChange={(v) => set("productUpdates", v)}
          title="Product updates"
          sub="New engines, new checks and occasional changelog notes."
        />
      </Section>

      <Section title="Danger zone" sub="Irreversible actions for this demo workspace.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-chalk">Reset workspace settings</p>
            <p className="mt-0.5 text-xs text-mist-dim">Restores tracking and notification preferences to defaults.</p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-coral/40 px-4 py-2 text-sm text-coral transition-colors hover:bg-coral/10"
          >
            Reset settings
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-chalk">Sign out of this device</p>
            <p className="mt-0.5 text-xs text-mist-dim">Ends the session cookie immediately.</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="rounded-full border border-line px-4 py-2 text-sm text-mist transition-colors hover:border-line-strong hover:text-chalk"
          >
            Sign out
          </button>
        </div>
      </Section>

      <div className="flex items-center justify-end gap-4">
        <span aria-live="polite" className="font-mono text-xs">
          {status === "saved" && <span className="text-mint">✓ Saved</span>}
          {status === "saving" && <span className="text-mist-dim">Saving…</span>}
          {status === "error" && <span className="text-coral">Could not save — try again</span>}
        </span>
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-full bg-gradient-to-r from-iris to-aqua px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Save changes
        </button>
      </div>
    </form>
  );
}
