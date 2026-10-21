import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { CtaBand } from "@/components/home/cta-band";
import { ButtonArrow } from "@/components/ui/button";

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

const team = [
  { name: "Advik Sharma", role: "Co-founder, Product" },
  { name: "Udayan Verma", role: "Co-founder, Engineering" },
  { name: "Meera Iyer", role: "Head of Design" },
  { name: "Jonas Lindqvist", role: "ML Lead" },
  { name: "Aisha Bello", role: "Customer Success" },
  { name: "Tomás Herrera", role: "Growth" },
];

const stats = [
  { value: "5,700+", label: "teams onboard" },
  { value: "11,400+", label: "brands tracked" },
  { value: "18", label: "countries" },
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
              <ButtonArrow href="/contact?intent=demo">Book a demo</ButtonArrow>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
            {stats.map((s) => (
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
              kicker="Team"
              title="Small team, one obsession"
              sub="Distributed across Bengaluru, Lisbon and Stockholm."
            />
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((m, i) => (
              <Reveal key={m.name} delay={i * 60}>
                <div className="glass glass-hover flex items-center gap-4 rounded-2xl p-6">
                  <span
                    className="flex size-12 shrink-0 items-center justify-center rounded-full border border-line bg-gradient-to-br from-iris/30 to-aqua/20 font-medium text-chalk"
                    aria-hidden
                  >
                    {m.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-chalk">{m.name}</div>
                    <div className="text-xs text-mist-dim">{m.role}</div>
                  </div>
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
