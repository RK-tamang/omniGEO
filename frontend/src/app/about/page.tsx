import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { CtaBand } from "@/components/home/cta-band";

export const metadata: Metadata = {
  title: "About",
  description:
    "OmniGEO is built by a small team who got tired of paying for four tools and still guessing what to publish. Meet the team and the principles behind the platform.",
  alternates: { canonical: "/about" },
};

const principles = [
  {
    title: "Show the source",
    body: "Every AI-generated claim in the product carries a citation back to where it came from. If we ask you to trust the output, you should be able to check it.",
  },
  {
    title: "Fixes, not dashboards",
    body: "A wall of metrics is a way of avoiding a decision. Every screen ends in a ranked list of things to do — and closes itself when they're done.",
  },
  {
    title: "One workspace, whole stack",
    body: "SEO tools, AI visibility and content were never separate problems. We refuse to sell them as separate subscriptions.",
  },
  {
    title: "Your data stays yours",
    body: "Documents and workspaces are isolated per account, encrypted, and never used to train shared models. Full stop.",
  },
];

const focus = [
  { value: "4", label: "answer engines tracked" },
  { value: "1", label: "workspace, one source of truth" },
  { value: "75", label: "tools in the suite" },
  { value: "2023", label: "founded" },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-20 pt-24 lg:pt-32">
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="aurora -top-24 right-10 size-[440px] bg-aqua/12" aria-hidden />
        <div className="container-page relative">
          <div className="max-w-3xl">
            <p className="kicker mb-4">
              <span className="size-1 rounded-full bg-iris" />
              About us
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-chalk sm:text-5xl lg:text-[3.4rem]">
              We got tired of paying for four tools and still{" "}
              <span className="font-display font-normal italic text-gradient">guessing what to publish.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-mist">
              OmniGEO started inside an agency that ran SEO for fifty clients. The team had rank trackers, audit tools
              and three AI writers — and no answer to the question clients kept asking: <em className="not-italic text-chalk">what
              does ChatGPT say about us?</em> So we built the answer, and eventually the whole platform around it.
            </p>
            <div className="mt-9">
            </div>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
            {focus.map((s) => (
              <div key={s.label} className="bg-ink-950 px-6 py-8">
                <div className="font-display text-4xl text-gradient">{s.value}</div>
                <div className="mt-1.5 font-mono text-[0.65rem] uppercase tracking-widest text-mist-dim">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-ink-900/40 py-20 lg:py-28">
        <div className="container-page">
          <Reveal>
            <SectionHeading kicker="Principles" title="How we build" />
          </Reveal>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {principles.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <div className="h-full bg-ink-950 p-8">
                  <span className="font-mono text-[0.7rem] text-iris">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-lg font-medium text-chalk">{p.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-mist">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="container-page">
          <Reveal>
            <SectionHeading
              kicker="What we work on"
              title="One platform, four layers"
              sub="Every part of OmniGEO is built around the same workspace, so the answers line up."
            />
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Visibility tracking", role: "Prompts, mentions and citations across four engines" },
              { name: "Site audit", role: "Crawlability, on-page structure and AI readiness" },
              { name: "Content studio", role: "Drafts scored for citation-readiness, sources linked" },
              { name: "Reporting", role: "Alerts, digests and exports on the same tracked data" },
            ].map((m, i) => (
              <Reveal key={m.name} delay={i * 60}>
                <div className="glass glass-hover flex h-full flex-col rounded-2xl p-6">
                  <div className="text-sm font-medium text-chalk">{m.name}</div>
                  <div className="mt-2 text-xs leading-relaxed text-mist-dim">{m.role}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
