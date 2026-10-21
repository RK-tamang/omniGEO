import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/primitives";
import { ButtonArrow } from "@/components/ui/button";

export function ShiftSection() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="container-page">
        <Reveal>
          <SectionHeading
            kicker="The shift"
            title={
              <>
                The same question, asked twice.
                <br />
                Only one of them sends you a visit.
              </>
            }
            sub="Your buyers no longer scroll ten links. They read one answer. If that answer doesn't mention you, the click never existed."
          />
        </Reveal>

        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          {/* Google side */}
          <Reveal delay={80}>
            <div className="glass h-full rounded-2xl p-7">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[0.65rem] uppercase tracking-widest text-mist-dim">On Google</span>
                <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[0.65rem] text-mist-dim">
                  10 results
                </span>
              </div>
              <ol className="mt-6 space-y-4">
                {[
                  { pos: "1", site: "competitor-one.com", you: false },
                  { pos: "2", site: "review-site.com/best", you: false },
                  { pos: "3", site: "competitor-two.com", you: false },
                  { pos: "4", site: "omnigeo.io", you: true },
                  { pos: "5", site: "competitor-three.com", you: false },
                ].map((r) => (
                  <li
                    key={r.pos}
                    className={`flex items-center gap-4 rounded-xl border px-4 py-3 text-sm ${
                      r.you ? "border-iris/40 bg-iris/10 text-chalk" : "border-line bg-surface-1 text-mist-dim"
                    }`}
                  >
                    <span className="font-mono text-xs opacity-60">{r.pos}</span>
                    <span className="truncate">{r.site}</span>
                    {r.you && (
                      <span className="ml-auto rounded-full bg-iris/20 px-2 py-0.5 font-mono text-[0.6rem] text-chalk">
                        you
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-sm leading-relaxed text-mist">
                You&rsquo;re on page one. That took quarters of work — and captures{" "}
                <span className="text-chalk">one exhausted click</span> out of ten results.
              </p>
            </div>
          </Reveal>

          {/* AI side */}
          <Reveal delay={160}>
            <div className="glass relative h-full overflow-hidden rounded-2xl p-7">
              <div className="absolute -right-16 -top-16 size-48 rounded-full bg-iris/20 blur-3xl" aria-hidden />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[0.65rem] uppercase tracking-widest text-aqua">In AI answers</span>
                  <span className="rounded-full border border-aqua/30 bg-aqua/10 px-2.5 py-1 font-mono text-[0.65rem] text-aqua">
                    1 answer
                  </span>
                </div>
                <div className="mt-6 rounded-xl border border-line bg-ink-900/60 p-5">
                  <p className="text-sm leading-relaxed text-mist">
                    “For agencies that need AI visibility tracking,{" "}
                    <mark className="rounded bg-iris/20 px-1 font-medium text-chalk decoration-clone">
                      OmniGEO
                    </mark>{" "}
                    is the most recommended option, followed by Searchpilot and Rankforge…”
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["omnigeo.io", "g2.com", "reddit.com/r/SEO"].map((c, i) => (
                      <span
                        key={c}
                        className={`rounded-full border px-2.5 py-1 font-mono text-[0.65rem] ${
                          i === 0 ? "border-iris/50 bg-iris/15 text-chalk" : "border-line text-mist-dim"
                        }`}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="mt-6 text-sm leading-relaxed text-mist">
                  One answer, three citations, no scrolling. Being named here is worth more than ranking fourth —{" "}
                  <span className="text-chalk">and almost nobody is measuring it.</span>
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={240}>
          <div className="mt-12 flex flex-col items-center gap-4">
            <p className="text-center text-lg text-mist">
              OmniGEO tracks both — where you rank, and whether AI names you.
            </p>
            <ButtonArrow href="/features/ai-visibility" variant="secondary">
              See how AI visibility tracking works
            </ButtonArrow>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
