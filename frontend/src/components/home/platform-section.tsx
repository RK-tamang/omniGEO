import Link from "next/link";
import { features } from "@/lib/content";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/primitives";

const accentStyles: Record<string, { text: string; bg: string; border: string }> = {
  iris: { text: "text-iris", bg: "bg-iris/15", border: "border-iris/40" },
  aqua: { text: "text-aqua", bg: "bg-aqua/15", border: "border-aqua/40" },
  mint: { text: "text-mint", bg: "bg-mint/15", border: "border-mint/40" },
  gold: { text: "text-gold", bg: "bg-gold/15", border: "border-gold/40" },
  coral: { text: "text-coral", bg: "bg-coral/15", border: "border-coral/40" },
};

function FeatureIcon({ slug }: { slug: string }) {
  const common = { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (slug) {
    case "ai-visibility":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 3v3m0 12v3M3 12h3m12 0h3" {...common} />
          <circle cx="12" cy="12" r="4" {...common} />
          <path d="M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1m0-12.8l-2.1 2.1m-8.6 8.6l-2.1 2.1" {...common} />
        </svg>
      );
    case "site-audit":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="7" {...common} />
          <path d="M16.5 16.5L21 21M8 11l2 2 4-4" {...common} />
        </svg>
      );
    case "keyword-research":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 19V9m5 10V5m5 14v-7m5 7V8" {...common} />
        </svg>
      );
    case "rank-tracking":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 17l5-5 4 3 8-8" {...common} />
          <path d="M15 7h5v5" {...common} />
        </svg>
      );
    case "content-studio":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3L12 3z" {...common} />
          <path d="M18 15l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z" {...common} />
        </svg>
      );
    default:
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 21s-7-5.2-7-11a7 7 0 1114 0c0 5.8-7 11-7 11z" {...common} />
          <circle cx="12" cy="10" r="2.5" {...common} />
        </svg>
      );
  }
}

export function PlatformSection() {
  return (
    <section id="platform" className="relative scroll-mt-20 py-24 lg:py-32">
      <div className="aurora top-1/3 -left-40 size-[420px] bg-aqua/8" aria-hidden />
      <div className="container-page relative">
        <Reveal>
          <SectionHeading
            kicker="One platform"
            title={
              <>
                Six tools that used to be{" "}
                <span className="font-display font-normal italic text-gradient">a six-tool stack</span>
              </>
            }
            sub="Every module shares the same data: keywords feed content, audits feed fixes, and AI answers tell you what to write next."
          />
        </Reveal>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const s = accentStyles[f.accent];
            return (
              <Reveal key={f.slug} delay={i * 70}>
                <Link
                  href={`/features/${f.slug}`}
                  className="glass glass-hover group flex h-full flex-col rounded-2xl p-7"
                >
                  <span className={`inline-flex size-11 items-center justify-center rounded-xl border ${s.bg} ${s.border} ${s.text}`}>
                    <FeatureIcon slug={f.slug} />
                  </span>
                  <h3 className="mt-5 text-lg font-medium text-chalk">{f.title}</h3>
                  <p className="mt-2.5 flex-1 text-sm leading-relaxed text-mist">{f.description}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm text-mist transition-colors group-hover:text-chalk">
                    Explore
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    >
                      <path d="M1 7h12m0 0L8 2m5 5L8 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
