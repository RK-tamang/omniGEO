import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/contact-form";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Book a demo, start a free trial or request a free site analysis. We respond within one business day.",
  alternates: { canonical: "/contact" },
};

const expectations = [
  { t: "We reply within a business day", b: "Every request is read by a human on the team — no ticket roulette." },
  { t: "The analysis comes first", b: "For site analyses, we send your AI-visibility report before any sales call." },
  { t: "No lock-in, ever", b: "Self-serve plans are month-to-month. Cancel from the dashboard in one click." },
];

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const { intent } = await searchParams;
  const valid = ["audit", "demo", "trial", "enterprise", "saas", "ecommerce", "b2b"] as const;
  const safeIntent = (valid as readonly string[]).includes(intent ?? "") ? (intent as (typeof valid)[number]) : "demo";

  return (
    <section className="relative overflow-hidden py-24 lg:py-28">
      <div className="grid-bg absolute inset-0" aria-hidden />
      <div className="aurora -top-32 -left-20 size-[460px] bg-iris/14" aria-hidden />
      <div className="container-page relative">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <div>
            <p className="kicker mb-4">
              <span className="size-1 rounded-full bg-iris" />
              Get in touch
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-chalk sm:text-5xl">
              Let&rsquo;s see what AI says{" "}
              <span className="font-display font-normal italic text-gradient">about you.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-mist">
              Send us your domain and we&rsquo;ll come back with a free analysis: where you rank, where AI names your
              competitors instead, and the three fixes that would move the needle first.
            </p>

            <div className="mt-10 space-y-6">
              {expectations.map((e, i) => (
                <Reveal key={e.t} delay={i * 80}>
                  <div className="flex gap-4">
                    <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[0.7rem] text-aqua">
                      {i + 1}
                    </span>
                    <div>
                      <h2 className="text-sm font-medium text-chalk">{e.t}</h2>
                      <p className="mt-1 max-w-sm text-sm leading-relaxed text-mist">{e.b}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="mt-12 border-t border-line pt-8">
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-mist-dim">Other ways to reach us</p>
              <p className="mt-3 text-sm text-mist">
                <a href="mailto:hello@omnigeo.io" className="text-chalk underline decoration-iris/50 underline-offset-4 hover:decoration-iris">
                  hello@omnigeo.io
                </a>
                <span className="mx-2 text-mist-dim">·</span>
                Bengaluru · Lisbon · Stockholm
              </p>
            </div>
          </div>

          <div className="lg:pt-4">
            <ContactForm intent={safeIntent} />
          </div>
        </div>
      </div>
    </section>
  );
}
