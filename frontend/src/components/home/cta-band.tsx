import Link from "next/link";
import { ButtonArrow } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

export function CtaBand() {
  return (
    <section className="relative overflow-hidden py-24 lg:py-28">
      <div className="aurora -top-40 left-1/2 size-[640px] -translate-x-1/2 bg-iris/18" aria-hidden />
      <div className="container-page relative">
        <Reveal>
          <div className="glass relative overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16">
            <div
              className="absolute inset-x-0 top-0 h-px strip-line"
              aria-hidden
            />
            <h2 className="text-balance mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-chalk sm:text-4xl">
              Your buyers are asking AI about you{" "}
              <span className="font-display font-normal italic text-gradient">right now.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-mist">
              Run a free analysis of your domain and see what ChatGPT, Perplexity, Gemini and AI Overviews say — in
              about ten minutes.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonArrow size="lg" href="/scan">
                Analyze my site
              </ButtonArrow>
            </div>
            <p className="mt-6 font-mono text-xs tracking-wide text-mist-dim">
              No credit card · Results in 10 minutes · Cancel anytime
            </p>
            <Link
              href="/dashboard"
              className="group mt-4 inline-flex items-center gap-1.5 text-sm text-mist underline decoration-line-strong underline-offset-4 transition-colors hover:text-chalk"
            >
              or explore the live demo dashboard
              <svg
                width="13"
                height="13"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                <path
                  d="M1 7h12m0 0L8 2m5 5L8 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
