import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/primitives";

const audiences = [
  {
    title: "Agencies",
    body: "Every client in its own workspace, all from one login.",
    href: "/contact?intent=agency",
  },
  {
    title: "SaaS & Software",
    body: "Win the comparisons and the AI shortlists buyers use.",
    href: "/contact?intent=saas",
  },
  {
    title: "Ecommerce & D2C",
    body: "Products found on Google and recommended by AI.",
    href: "/contact?intent=ecommerce",
  },
  {
    title: "Local & Multi-location",
    body: "Every location ranked on the map, every review answered.",
    href: "/features/local-seo",
  },
  {
    title: "B2B Companies",
    body: "Found by buyers who research for weeks before they call.",
    href: "/contact?intent=b2b",
  },
  {
    title: "Enterprise",
    body: "Many brands and sites, with a team that runs it with you.",
    href: "/contact?intent=enterprise",
  },
];

export function Audiences() {
  return (
    <section className="relative border-y border-line bg-ink-900/40 py-24 lg:py-32">
      <div className="container-page">
        <Reveal>
          <SectionHeading
            kicker="Who it's for"
            title="Built for every team that needs to be found"
          />
        </Reveal>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map((a, i) => (
            <Reveal key={a.title} delay={i * 60}>
              <Link
                href={a.href}
                className="group flex h-full flex-col bg-ink-950 p-7 transition-colors duration-300 hover:bg-ink-900"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-chalk">{a.title}</h3>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden
                    className="text-mist-dim transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-iris"
                  >
                    <path d="M1 7h12m0 0L8 2m5 5L8 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-mist">{a.body}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
