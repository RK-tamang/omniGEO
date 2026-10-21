"use client";

import { useState } from "react";
import { plans } from "@/lib/content";
import { formatINR } from "@/lib/format";
import { ButtonArrow } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

export function PricingPlans() {
  const [yearly, setYearly] = useState(true);

  return (
    <>
      <div className="mb-12 flex flex-col items-center gap-4">
        <div
          className="glass inline-flex items-center rounded-full p-1"
          role="group"
          aria-label="Billing period"
        >
          <button
            type="button"
            onClick={() => setYearly(false)}
            aria-pressed={!yearly}
            className={`rounded-full px-5 py-2 text-sm transition-all ${
              !yearly ? "bg-surface-3 text-chalk shadow-sm" : "text-mist hover:text-chalk"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setYearly(true)}
            aria-pressed={yearly}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm transition-all ${
              yearly ? "bg-surface-3 text-chalk shadow-sm" : "text-mist hover:text-chalk"
            }`}
          >
            Yearly
            <span className="rounded-full bg-mint/15 px-2 py-0.5 font-mono text-[0.6rem] text-mint">−20%</span>
          </button>
        </div>
        <p className="font-mono text-[0.7rem] text-mist-dim">
          {yearly ? "Two months free · billed annually" : "Billed monthly · cancel anytime"}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((p, i) => {
          const price = yearly ? p.yearly : p.monthly;
          return (
            <Reveal key={p.name} delay={i * 90}>
              <div
                className={`glass relative flex h-full flex-col rounded-2xl p-8 ${
                  p.highlight
                    ? "border-highlight/40 shadow-[0_0_80px_-24px_var(--color-highlight-wash)]"
                    : ""
                }`}
              >
                {p.highlight && (
                  <span className="strip-fill absolute -top-3 left-8 rounded-full px-3 py-1 font-mono text-[0.6rem] font-medium uppercase tracking-widest">
                    Most popular
                  </span>
                )}
                <h2 className="text-lg font-medium text-chalk">{p.name}</h2>
                <p className="mt-2 min-h-[3rem] text-sm leading-relaxed text-mist">{p.blurb}</p>

                <div className="mt-6">
                  <div className="flex items-baseline gap-1.5">
                    <span key={price} className="text-4xl font-semibold tracking-tight text-chalk">
                      {formatINR(price)}
                    </span>
                    <span className="text-sm text-mist-dim">/ mo</span>
                  </div>
                  <p className="mt-1.5 font-mono text-[0.7rem] text-mist-dim">
                    {yearly
                      ? `billed ${formatINR(price * 12)}/yr — save ${formatINR((p.monthly - p.yearly) * 12)}`
                      : "billed monthly, cancel anytime"}
                  </p>
                </div>

                <div className="mt-7 flex-1">
                  <ButtonArrow
                    href="/contact?intent=trial"
                    variant={p.highlight ? "primary" : "secondary"}
                    className="w-full"
                  >
                    Start free trial
                  </ButtonArrow>
                  <ul className="mt-7 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-mist">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          className="mt-0.5 shrink-0 text-aqua"
                          aria-hidden
                        >
                          <path
                            d="M2 7.5l3.5 3.5L12 3.5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
