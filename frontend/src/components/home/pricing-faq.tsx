import { homeFaqs, plans } from "@/lib/content";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/primitives";
import { ButtonArrow } from "@/components/ui/button";
import { Faq } from "@/components/ui/faq";
import { formatINR } from "@/lib/format";

export function PricingTeaser() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="aurora -top-20 right-0 size-[420px] bg-iris/12" aria-hidden />
      <div className="container-page relative">
        <Reveal>
          <SectionHeading
            kicker="Pricing"
            title={
              <>
                Per workspace, <span className="font-display font-normal italic text-gradient">not per seat</span>
              </>
            }
            sub="Bring the whole team. 7 days free on any self-serve plan — nothing is charged until the trial ends."
          />
        </Reveal>

        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={i * 90}>
              <div
                className={`glass flex h-full flex-col rounded-2xl p-7 ${
                  p.highlight ? "border-iris/40 shadow-[0_0_60px_-20px_rgba(62,124,176,0.5)]" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-chalk">{p.name}</h3>
                  {p.highlight && (
                    <span className="rounded-full border border-iris/40 bg-iris/15 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-widest text-chalk">
                      Most popular
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-mist">{p.blurb}</p>
                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold text-chalk">{formatINR(p.yearly)}</span>
                  <span className="text-sm text-mist-dim">/ mo, billed yearly</span>
                </div>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {p.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-mist">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0 text-aqua" aria-hidden>
                        <path d="M2 7.5l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-7">
                  <ButtonArrow href="/pricing" variant={p.highlight ? "primary" : "secondary"} className="w-full">
                    Start free trial
                  </ButtonArrow>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <p className="mt-10 text-center text-sm text-mist">
            Need SSO, audit logs or a custom workspace count?{" "}
            <a href="/contact?intent=enterprise" className="text-chalk underline decoration-iris/50 underline-offset-4 hover:decoration-iris">
              Talk to sales
            </a>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-line bg-ink-900/40 py-24 lg:py-28">
      <div className="container-page">
        <Reveal>
          <SectionHeading kicker="FAQ" title="Questions, answered" />
        </Reveal>
        <Reveal delay={100}>
          <Faq items={homeFaqs} />
        </Reveal>
      </div>
    </section>
  );
}
