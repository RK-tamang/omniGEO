import { Button, ButtonArrow } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { AnswerDemo } from "@/components/home/answer-demo";
import { site } from "@/lib/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* backdrop */}
      <div className="grid-bg absolute inset-0" aria-hidden />
      <div className="aurora -top-32 -left-32 size-[520px] bg-iris/20 animate-drift" aria-hidden />
      <div className="aurora top-10 right-0 size-[420px] bg-aqua/10 animate-drift [animation-delay:-8s]" aria-hidden />
      <div
        className="absolute inset-x-0 top-0 h-px strip-line"
        aria-hidden
      />

      <div className="container-page relative pb-24 pt-20 lg:pb-32 lg:pt-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <Badge>Now tracking 4 AI answer engines + Google</Badge>

            <h1 className="text-balance mt-7 text-4xl font-semibold leading-[1.05] tracking-tight text-chalk sm:text-5xl lg:text-[3.9rem]">
              Be the brand{" "}
              <span className="font-display font-normal italic text-gradient">AI recommends</span>
              <br className="hidden sm:block" /> when buyers ask.
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-mist">
              See how ChatGPT, Perplexity, Gemini and Google AI Overviews describe your business — then get the audits,
              keywords and grounded content to change it. One platform, from mention to fix.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonArrow size="lg" href="/scan">
                Analyze my site
              </ButtonArrow>
              <Button size="lg" variant="secondary" href="/pricing">
                See pricing
              </Button>
            </div>

            <p className="mt-6 font-mono text-xs tracking-wide text-mist-dim">{site.trialNote}</p>

            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line pt-6">
              <Metric value="11,400+" label="brands tracked" />
              <span className="h-8 w-px bg-line" aria-hidden />
              <Metric value="5,700+" label="teams onboard" />
              <span className="hidden h-8 w-px bg-line sm:block" aria-hidden />
              <Metric value="18" label="countries" />
            </div>
          </div>

          <div className="relative">
            <AnswerDemo />
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-xl font-semibold text-chalk">{value}</div>
      <div className="font-mono text-[0.65rem] uppercase tracking-widest text-mist-dim">{label}</div>
    </div>
  );
}
