import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/primitives";

const steps = [
  {
    n: "01",
    title: "Connect your site",
    body: "Point OmniGEO at your domain. The first crawl and AI-answer sweep complete within hours — no tags, no dev ticket.",
  },
  {
    n: "02",
    title: "See the gaps",
    body: "One screen shows where you rank on Google, where AI names competitors instead, and which sources the models cite.",
  },
  {
    n: "03",
    title: "Ship the fixes",
    body: "Every gap arrives with a ranked fix list. Draft grounded content, repair technical issues, and watch mention rate move.",
  },
];

export function HowItWorks() {
  return (
    <section className="relative border-y border-line bg-ink-900/40 py-24 lg:py-28">
      <div className="container-page">
        <Reveal>
          <SectionHeading
            kicker="How it works"
            title="From domain to mentions in three steps"
            sub="Most teams see their first AI-visibility report the same afternoon they sign up."
          />
        </Reveal>

        <div className="relative mt-16 grid gap-10 lg:grid-cols-3 lg:gap-8">
          <div className="absolute left-0 right-0 top-[2.4rem] hidden h-px strip-line lg:block" aria-hidden />
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <div className="relative">
                <span className="relative z-10 inline-flex size-12 items-center justify-center rounded-full border border-line bg-ink-950 font-mono text-sm text-gradient">
                  {s.n}
                </span>
                <h3 className="mt-6 text-xl font-medium text-chalk">{s.title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-mist">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
