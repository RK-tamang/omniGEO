import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Shared shell for the legal pages (Privacy, Terms, Data Processing).
 *
 * These pages are long, mostly-monospaced documents, so they get a table of
 * contents that sticks to the side on wide screens and collapses inline on
 * mobile — the same pattern legal pages use elsewhere on the web.
 */

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

export function LegalPage({
  kicker,
  title,
  intro,
  updated,
  sections,
  contactEmail = "legal@omnigeo.io",
}: {
  kicker: string;
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
  contactEmail?: string;
}) {
  return (
    <section className="relative overflow-hidden py-20 lg:py-28">
      <div className="grid-bg absolute inset-0" aria-hidden />
      <div className="aurora -top-32 -left-20 size-[420px] bg-iris/10" aria-hidden />

      <div className="container-page relative">
        <div className="max-w-3xl">
          <p className="kicker mb-4">
            <span className="size-1 rounded-full bg-iris" />
            {kicker}
          </p>
          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-chalk sm:text-5xl">
            {title}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-mist">{intro}</p>
          <p className="mt-5 font-mono text-[0.65rem] uppercase tracking-widest text-mist-dim">Last updated {updated}</p>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-16">
          {/* Table of contents */}
          <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-mist-dim">On this page</p>
            <ol className="mt-4 space-y-2 border-l border-line pl-4">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-sm leading-snug text-mist transition-colors hover:text-chalk"
                  >
                    <span className="font-mono text-[0.65rem] text-mist-dim">{String(i + 1).padStart(2, "0")}</span>{" "}
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Document body */}
          <div className="prose-omni max-w-none">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-28">
                <h2>{s.title}</h2>
                {s.body}
              </section>
            ))}

            <section className="scroll-mt-28">
              <h2>Contact</h2>
              <p>
                Questions about this document, or a request to exercise one of your rights? Write to{" "}
                <a href={`mailto:${contactEmail}`}>{contactEmail}</a> and we will respond within thirty days.
              </p>
              <p>
                See also our <Link href="/privacy">Privacy Policy</Link> and{" "}
                <Link href="/terms">Terms of Service</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
