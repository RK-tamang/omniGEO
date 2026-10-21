import type { Metadata } from "next";
import Link from "next/link";
import { ScanRunner } from "@/components/scan/scan-runner";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "Free AI visibility scan",
  description:
    "Scan any domain for AI search visibility: crawler access, entity clarity, citations and a competitor snapshot — in under a minute.",
  alternates: { canonical: "/scan" },
};

const CHECKS = [
  {
    title: "Crawler access",
    body: "Whether GPTBot, OAI-SearchBot, PerplexityBot and Google-Extended can actually read your pages.",
  },
  {
    title: "Entity clarity",
    body: "Organization schema, named authors and the signals that let a model resolve who you are.",
  },
  {
    title: "Citation presence",
    body: "A sample prompt set run across ChatGPT, Perplexity, Gemini and AI Overviews.",
  },
  {
    title: "Content structure",
    body: "Whether your answers are built to be lifted cleanly — direct answer first, evidence second.",
  },
  {
    title: "Competitor snapshot",
    body: "Who gets named instead of you, and by how much, in the same prompt set.",
  },
  {
    title: "Fix list",
    body: "A prioritised set of the highest-leverage corrections, with effort and impact.",
  },
];

export default function ScanPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-24 lg:pt-28">
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="aurora -top-32 left-1/4 size-[520px] bg-iris/14" aria-hidden />

        <div className="container-page relative">
          <Reveal>
            <p className="kicker mb-4">
              <span className="size-1 rounded-full bg-aqua" />
              Free scan
            </p>
            <h1 className="text-balance max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-chalk sm:text-5xl lg:text-[3.4rem]">
              See what AI says about{" "}
              <span className="font-display font-normal italic text-gradient">your domain.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-mist">
              We check whether AI crawlers can reach you, how clearly your entity reads, and which answers cite your
              competitors instead — then hand you the fix list.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-10 max-w-2xl">
              <ScanRunner />
              <p className="mt-4 font-mono text-[0.65rem] tracking-wide text-mist-dim">
                About 40 seconds · no account needed · demo report, illustrative data
              </p>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-6 text-sm text-mist">
              Just want to look around?{" "}
              <Link
                href="/scan/demo?d=northwindlabs.com"
                className="underline decoration-iris/50 underline-offset-4 hover:text-chalk"
              >
                View a sample report →
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line bg-ink-900/40 py-20">
        <div className="container-page">
          <Reveal>
            <p className="kicker mb-4">
              <span className="size-1 rounded-full bg-iris" />
              What we check
            </p>
            <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-chalk sm:text-3xl">
              Six checks that decide whether AI recommends you
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CHECKS.map((c, i) => (
              <Reveal key={c.title} delay={i * 60}>
                <div className="glass h-full rounded-2xl p-6">
                  <span className="font-mono text-[0.6rem] text-iris">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-base font-medium text-chalk">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mist">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container-page">
          <Reveal>
            <div className="glass relative overflow-hidden rounded-3xl px-8 py-12 text-center sm:px-14">
                <div className="absolute inset-x-0 top-0 h-px strip-line" aria-hidden />
              <h2 className="mx-auto max-w-xl text-2xl font-semibold tracking-tight text-chalk sm:text-3xl">
                The free scan shows a sample. The workspace tracks all 50 prompts.
              </h2>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="rounded-full bg-gradient-to-r from-iris to-aqua px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Open the demo dashboard
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-full border border-line px-6 py-3 text-sm text-mist transition-colors hover:border-line-strong hover:text-chalk"
                >
                  See pricing
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
