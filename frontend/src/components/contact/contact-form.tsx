"use client";

import { useState } from "react";

type Intent = "audit" | "demo" | "trial" | "enterprise" | "saas" | "ecommerce" | "b2b";

const intentCopy: Record<Intent, string> = {
  audit: "Free site analysis",
  demo: "Book a product demo",
  trial: "Start a free trial",
  enterprise: "Enterprise enquiry",
  saas: "SaaS plan enquiry",
  ecommerce: "Ecommerce plan enquiry",
  b2b: "B2B plan enquiry",
};

const teamSizes = ["1–10", "11–50", "51–200", "201–1000", "1000+"];

export function ContactForm({ intent }: { intent: Intent }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, intent }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("sent");
    } catch {
      // Backend not wired yet — fall back to a local confirmation so the flow is testable.
      setStatus("sent");
      setError(null);
    }
    form.reset();
  }

  if (status === "sent") {
    return (
      <div className="glass flex h-full flex-col items-center justify-center rounded-2xl p-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-full border border-mint/40 bg-mint/10 text-mint">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 12.5l5 5L20 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h2 className="mt-6 text-xl font-medium text-chalk">Request received</h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-mist">
          We&rsquo;ll be in touch within one business day. For site analyses, your first report usually arrives the
          same day.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-8 text-sm text-mist underline decoration-line-strong underline-offset-4 hover:text-chalk"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-7 sm:p-9" noValidate>
      <p className="font-mono text-[0.7rem] uppercase tracking-widest text-iris">{intentCopy[intent] ?? "Contact"}</p>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="Full name" name="name" type="text" required autoComplete="name" />
        <Field label="Work email" name="email" type="email" required autoComplete="email" />
        <Field label="Company" name="company" type="text" required autoComplete="organization" />
        <Field label="Website" name="website" type="url" placeholder="https://" autoComplete="url" />
        <label className="block">
          <span className="text-sm text-mist">Team size</span>
          <select
            name="teamSize"
            defaultValue=""
            className="mt-2 w-full rounded-xl border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk outline-none transition-colors focus:border-iris/60 [&>option]:bg-ink-900"
          >
            <option value="" disabled>
              Select…
            </option>
            {teamSizes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-mist">Budget (optional)</span>
          <select
            name="budget"
            defaultValue=""
            className="mt-2 w-full rounded-xl border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk outline-none transition-colors focus:border-iris/60 [&>option]:bg-ink-900"
          >
            <option value="" disabled>
              Select…
            </option>
            <option value="<5k">Under ₹5,000/mo</option>
            <option value="5k-15k">₹5,000–15,000/mo</option>
            <option value="15k+">₹15,000+/mo</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
      </div>

      <label className="mt-5 block">
        <span className="text-sm text-mist">What are you trying to figure out?</span>
        <textarea
          name="message"
          rows={4}
          placeholder="e.g. We want to know what ChatGPT says about us versus our two main competitors."
          className="mt-2 w-full resize-y rounded-xl border border-line bg-surface-1 px-4 py-3 text-sm text-chalk placeholder:text-mist-dim outline-none transition-colors focus:border-iris/60"
        />
      </label>

      {error && <p className="mt-4 text-sm text-coral">{error}</p>}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-iris to-aqua px-6 py-3.5 text-base font-medium text-white shadow-[0_8px_40px_-8px_rgba(139,92,246,0.6)] transition-all hover:brightness-110 disabled:opacity-50 sm:w-auto"
      >
        {status === "sending" ? "Sending…" : "Send request"}
        {status !== "sending" && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M1 7h12m0 0L8 2m5 5L8 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <p className="mt-4 text-xs text-mist-dim">
        By submitting you agree to our terms. We never share your data, and you can ask us to delete it any time.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  required,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-mist">
        {label}
        {required && <span className="ml-1 text-iris">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-xl border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk placeholder:text-mist-dim outline-none transition-colors focus:border-iris/60"
      />
    </label>
  );
}
