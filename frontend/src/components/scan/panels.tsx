import { StatusChip } from "@/components/dashboard/panel";
import type { ScanReport } from "@/lib/scan-data";

function PanelHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold tracking-tight text-chalk sm:text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-mist">{sub}</p>
    </div>
  );
}

const statusChipStyles: Record<string, string> = {
  allowed: "border-mint/40 bg-mint/10 text-mint",
  blocked: "border-coral/40 bg-coral/10 text-coral",
  limited: "border-gold/40 bg-gold/10 text-gold",
};

function BotChip({ status }: { status: "allowed" | "blocked" | "limited" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${statusChipStyles[status]}`}
    >
      {status === "limited" ? "rate-limited" : status}
    </span>
  );
}

/* ------------------------------- 1 · Pages -------------------------------- */

export function PagesPanel({ r }: { r: ScanReport }) {
  return (
    <section className="glass rounded-2xl p-6 sm:p-8">
      <PanelHead
        title="Reading your pages"
        sub={`We open ${r.domain} the way a visitor and a crawler both do, and follow every link we can reach. Each page is checked for headings, images, text and structured data.`}
      />

      {/* browser mock */}
      <div className="mt-7 overflow-hidden rounded-xl border border-line bg-ink-950/80">
        <div className="flex items-center gap-3 border-b border-line bg-surface-1 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-coral/70" />
            <span className="size-2.5 rounded-full bg-gold/70" />
            <span className="size-2.5 rounded-full bg-mint/70" />
          </span>
          <span className="flex-1 truncate rounded-md border border-line bg-black/40 px-3 py-1 font-mono text-[0.62rem] text-mist">
            https://{r.domain}
          </span>
          <span className="hidden font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim sm:block">fetched</span>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex gap-4 font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim" aria-hidden>
            {["Home", "Product", "Pricing", "Blog", "Docs"].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
          <h3 className="text-lg font-medium text-chalk">{r.crawled.homeTitle}</h3>
          <div className="space-y-1.5" aria-hidden>
            <div className="h-2 w-full rounded bg-surface-3" />
            <div className="h-2 w-11/12 rounded bg-surface-3" />
            <div className="h-2 w-8/12 rounded bg-surface-3" />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 font-mono text-[0.62rem] text-mist">
            <span>{r.crawled.headings} headings</span>
            <span>{r.crawled.words.toLocaleString("en-GB")} words</span>
            <span className={r.crawled.noAlt > 6 ? "text-gold" : "text-mint"}>{r.crawled.noAlt} images without alt</span>
            <span>{r.crawled.links} links</span>
          </div>
        </div>
      </div>

      <p className="mt-5 flex flex-wrap items-center gap-2 font-mono text-[0.62rem] text-mist-dim">
        <span className="inline-flex size-4 items-center justify-center rounded-full border border-iris/50 text-iris">
          <span className="size-1.5 animate-pulse rounded-full bg-iris" />
        </span>
        Following links from your home page… {r.pagesCrawled} pages read in {r.duration}
      </p>
    </section>
  );
}

/* ----------------------------- 2 · Site health ---------------------------- */

export function HealthPanel({ r }: { r: ScanReport }) {
  const noAltPct = Math.round((r.health.noAltPages / Math.max(1, r.pagesCrawled)) * 100);
  const tiles = [
    { label: "Healthy pages", value: `${r.health.healthy}%`, tone: "text-mint", bar: "bg-mint" },
    { label: "Has something to fix", value: `${r.health.fix}%`, tone: "text-gold", bar: "bg-gold" },
    { label: "Images without alt", value: `${noAltPct}%`, tone: noAltPct > 8 ? "text-coral" : "text-mist", bar: noAltPct > 8 ? "bg-coral" : "bg-mist-dim" },
  ];

  return (
    <section className="glass rounded-2xl p-6 sm:p-8">
      <PanelHead
        title="What Google and AI read on your pages"
        sub="Titles, descriptions, headings, authors and image text on every page we fetched. An engine can only cite what it can read."
      />

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-line bg-surface-1 p-5">
            <p className={`font-display text-4xl font-normal italic leading-none ${t.tone}`}>{t.value}</p>
            <p className="mt-2 font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">{t.label}</p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
              <div className={`h-full rounded-full ${t.bar}`} style={{ width: t.value }} />
            </div>
          </div>
        ))}
      </div>

      <ul className="mt-6 divide-y divide-line">
        {r.health.pages.map((p) => (
          <li key={p.path} className="flex items-center justify-between gap-4 py-3">
            <span className="truncate font-mono text-xs text-chalk">{p.path}</span>
            <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-gold">
              {p.issue}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 font-mono text-[0.62rem] text-mist-dim">{r.pagesCrawled} pages checked · 4 shown</p>
    </section>
  );
}

/* ---------------------------- 3 · AI crawlers ----------------------------- */

export function CrawlersPanel({ r }: { r: ScanReport }) {
  const allowed = r.bots.filter((b) => b.status === "allowed").length;
  const blocked = r.bots.find((b) => b.status === "blocked");

  return (
    <section className="glass rounded-2xl p-6 sm:p-8">
      <PanelHead
        title="Which AI engines can read you"
        sub="Each bot is fetched with its real user-agent against your robots.txt — the difference between being cited and being invisible."
      />

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {r.bots.map((b) => (
          <div key={b.name} className="rounded-xl border border-line bg-surface-1 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-chalk">{b.name}</p>
                <p className="font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim">{b.owner}</p>
              </div>
              <BotChip status={b.status} />
            </div>
          </div>
        ))}
      </div>

      {blocked && (
        <div className="mt-6 rounded-xl border border-coral/40 bg-coral/[0.07] p-4">
          <p className="text-sm text-coral">
            {blocked.name} is blocked — that removes you from the training data behind one of the big four.
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-mist">
            Search-side bots can still read you, but a single targeted robots.txt edit future-proofs the whole set.
          </p>
        </div>
      )}

      <p className="mt-4 font-mono text-[0.62rem] text-mist-dim">
        {allowed}/{r.bots.length} allowed · re-checked every run
      </p>
    </section>
  );
}

/* ----------------------------- 4 · AI answers ----------------------------- */

export function AnswersPanel({ r }: { r: ScanReport }) {
  return (
    <section className="glass rounded-2xl p-6 sm:p-8">
      <PanelHead
        title="How AI answers questions about you"
        sub="We ask the engines what your buyers ask. Here is one answer, word for word, with who got cited."
      />

      {/* chat mock */}
      <div className="mt-7 overflow-hidden rounded-xl border border-line bg-ink-950/80">
        <div className="flex items-center justify-between border-b border-line bg-surface-1 px-4 py-2.5">
          <span className="flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-widest text-mist">
            <span className="size-1.5 rounded-full bg-mint" aria-hidden />
            ChatGPT · answering
          </span>
          <span className="font-mono text-[0.55rem] text-mist-dim">sampled this week</span>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex justify-end">
            <p className="max-w-md rounded-2xl rounded-br-md border border-iris/30 bg-iris/10 px-4 py-2.5 text-sm text-chalk">
              {r.answer.prompt}
            </p>
          </div>
          <div className="max-w-2xl">
            <p className="text-sm leading-relaxed text-mist">{r.answer.text}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.answer.cited.map((c) => {
                const isYou = c === r.domain || r.domain.endsWith(c);
                return (
                  <span
                    key={c}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.58rem] ${
                      isYou ? "border-iris/50 bg-iris/10 text-iris" : "border-line bg-surface-1 text-mist"
                    }`}
                  >
                    <span className="size-1 rounded-full bg-current" aria-hidden />
                    {c}
                  </span>
                );
              })}
            </div>
            {!r.answer.citesYou && (
              <p className="mt-3 font-mono text-[0.62rem] text-coral">✕ {r.domain} is not cited in this answer</p>
            )}
          </div>
        </div>
      </div>

      {/* prompt results */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line-strong font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
              <th className="pb-3 pr-4 font-normal">Prompt</th>
              <th className="pb-3 pr-4 font-normal">ChatGPT</th>
              <th className="pb-3 pr-4 font-normal">Perplexity</th>
              <th className="pb-3 pr-4 font-normal">Gemini</th>
              <th className="pb-3 font-normal">AI Overviews</th>
            </tr>
          </thead>
          <tbody>
            {r.promptSample.slice(0, 5).map((p) => (
              <tr key={p.prompt} className="border-b border-line/70">
                <td className="py-3 pr-4 text-chalk">{p.prompt}</td>
                <td className="py-3 pr-4">
                  <StatusChip status={p.statuses["ChatGPT"]} />
                </td>
                <td className="py-3 pr-4">
                  <StatusChip status={p.statuses["Perplexity"]} />
                </td>
                <td className="py-3 pr-4">
                  <StatusChip status={p.statuses["Gemini"]} />
                </td>
                <td className="py-3">
                  <StatusChip status={p.statuses["AI Overviews"]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 font-mono text-[0.62rem] text-mist-dim">
        {r.won}/{r.promptSample.length} sample prompts won across 4 engines
      </p>
    </section>
  );
}

/* ---------------------------- 5 · Competitors ----------------------------- */

export function RivalsPanel({ r }: { r: ScanReport }) {
  const sorted = [...r.competitors].sort((a, b) => b.mentionRate - a.mentionRate);
  const rival = r.competitors.find((c) => !c.you) ?? r.competitors[1];
  const shared = Math.round(rival.mentionRate * 3.2);

  return (
    <section className="glass rounded-2xl p-6 sm:p-8">
      <PanelHead
        title="Who takes your buyers"
        sub="Every prompt goes to whoever gets named first, scored like a match. This is the standings table."
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">Mention rate standings</p>
          <ul className="mt-4 space-y-4">
            {sorted.map((c, i) => (
              <li key={c.name}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2.5">
                    <span
                      className={`flex size-6 items-center justify-center rounded-md font-mono text-[0.6rem] ${
                        c.you ? "bg-iris/20 text-iris" : "bg-surface-3 text-mist"
                      }`}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span className={c.you ? "font-medium text-chalk" : "text-mist"}>{c.name}</span>
                  </span>
                  <span className="font-mono text-xs text-chalk">{c.mentionRate}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full ${c.you ? "bg-gradient-to-r from-iris to-aqua" : "bg-mist-dim"}`}
                    style={{ width: `${Math.max(5, c.mentionRate)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-surface-1 p-5">
            <p className="font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">Closest rival</p>
            <p className="mt-2 text-lg font-medium text-chalk">{rival.name}</p>
            <p className="mt-1 text-sm text-mist">
              {shared} shared prompts · it wins the comparison questions you are missing.
            </p>
          </div>
          <div className="rounded-xl border border-iris/30 bg-iris/[0.06] p-5">
            <p className="font-mono text-[0.58rem] uppercase tracking-widest text-iris">Your position</p>
            <p className="mt-2 text-lg font-medium text-chalk">
              #{sorted.findIndex((c) => c.you) + 1} of {sorted.length}
            </p>
            <p className="mt-1 text-sm text-mist">
              Strong in problem-aware prompts; the gap lives in comparisons and pricing questions.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
