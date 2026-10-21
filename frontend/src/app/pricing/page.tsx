import type { Metadata } from "next";
import { Fragment } from "react";
import { plans, planComparison, homeFaqs } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/primitives";
import { Faq } from "@/components/ui/faq";
import { Reveal } from "@/components/ui/reveal";
import { PricingPlans } from "@/components/pricing/pricing-plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "OmniGEO pricing — per workspace, not per seat. Plans from ₹4,999/mo with a 7-day free trial. Prompt discovery, AI visibility, site audits and fixes for generative engines.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-24 lg:pb-20 lg:pt-32">
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="aurora -top-24 left-1/3 size-[480px] bg-iris/16" aria-hidden />
        <div className="container-page relative">
          <SectionHeading
            as="h1"
            kicker="Pricing"
            title={
              <>
                Per workspace, <span className="font-display font-normal italic text-gradient">not per seat</span>
              </>
            }
            sub="7 days free on every self-serve plan. Nothing is charged until the trial ends, and you can cancel before it does."
          />
          <p className="mt-6 text-center text-sm text-mist-dim">
            All prices excl. GST · Billing in ₹, $ or € · Annual billing saves 20%
          </p>
        </div>
      </section>

      <section className="pb-24">
        <div className="container-page">
          <PricingPlans />

          <Reveal delay={120}>
            <div className="glass mt-8 flex flex-col items-center justify-between gap-5 rounded-2xl p-8 sm:flex-row">
              <div>
                <h2 className="text-lg font-medium text-chalk">Enterprise</h2>
                <p className="mt-1 text-sm text-mist">
                  SSO/SAML, audit logs, custom data residency, unlimited workspaces and a named success team.
                </p>
              </div>
              <Button href="/contact?intent=enterprise" variant="secondary" className="shrink-0">
                Talk to sales
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Comparison table */}
      <section className="border-t border-line bg-ink-900/40 py-24">
        <div className="container-page">
          <Reveal>
            <SectionHeading kicker="Compare" title="Every plan, side by side" />
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-14 overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line-strong">
                    <th className="w-2/5 pb-4 pr-4 font-mono text-[0.65rem] uppercase tracking-widest text-mist-dim">
                      Feature
                    </th>
                    {plans.map((p) => (
                      <th key={p.name} className="pb-4 pr-4 text-sm font-medium text-chalk">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {planComparison.map((group) => (
                    <Fragment key={group.group}>
                      <tr>
                        <td
                          colSpan={4}
                          className="pb-3 pt-8 font-mono text-[0.65rem] uppercase tracking-widest text-iris"
                        >
                          {group.group}
                        </td>
                      </tr>
                      {group.rows.map((row) => (
                        <tr key={row.label} className="border-b border-line">
                          <td className="py-3.5 pr-4 text-sm text-mist">{row.label}</td>
                          {row.values.map((v, i) => (
                            <td key={i} className="py-3.5 pr-4 text-sm text-chalk">
                              {v === "✓" ? (
                                <svg width="15" height="15" viewBox="0 0 14 14" fill="none" className="text-aqua" aria-label="Included">
                                  <path d="M2 7.5l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : (
                                v
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-24">
        <div className="container-page">
          <Reveal>
            <SectionHeading kicker="FAQ" title="Billing questions, answered" />
          </Reveal>
          <Reveal delay={100}>
            <Faq items={homeFaqs} />
          </Reveal>
        </div>
      </section>
    </>
  );
}
