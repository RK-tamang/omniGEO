import { testimonials } from "@/lib/content";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/primitives";

export function Testimonials() {
  return (
    <section className="py-24 lg:py-32">
      <div className="container-page">
        <Reveal>
          <SectionHeading
            kicker="Customer stories"
            title="Teams that stopped guessing"
            sub="Three of the 5,700+ teams running OmniGEO every week."
          />
        </Reveal>

        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 90}>
              <figure className="glass glass-hover flex h-full flex-col rounded-2xl p-7">
                <div className="mb-5 flex items-center gap-1 text-iris" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <svg key={s} width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
                      <path d="M7 0l1.9 4.4L13.6 5l-3.5 3.2.9 4.7L7 10.6 3 12.9l.9-4.7L.4 5l4.7-.6L7 0z" />
                    </svg>
                  ))}
                </div>
                <blockquote className="flex-1 text-sm leading-relaxed text-mist">&ldquo;{t.quote}&rdquo;</blockquote>
                <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
                  <figcaption>
                    <div className="text-sm font-medium text-chalk">{t.name}</div>
                    <div className="text-xs text-mist-dim">
                      {t.role} · {t.company}
                    </div>
                  </figcaption>
                  <div className="text-right">
                    <div className="font-display text-2xl text-gradient">{t.metric.value}</div>
                    <div className="max-w-[9rem] font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">
                      {t.metric.label}
                    </div>
                  </div>
                </div>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
