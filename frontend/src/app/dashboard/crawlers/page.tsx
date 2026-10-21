import type { Metadata } from "next";
import Link from "next/link";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { CrawlerBots } from "@/components/dashboard/crawler-bots";
import { crawlerKpis, crawlerWeaknesses, crawlSamples, robotsSnippet } from "@/lib/dashboard-data";

export const metadata: Metadata = { title: "AI Crawler Check" };

const engineStatusStyles: Record<string, string> = {
  allowed: "text-mint",
  blocked: "text-coral",
  limited: "text-gold",
  "n/a": "text-mist-dim",
};

export default function CrawlersPage() {
  return (
    <>
      <DashboardHeader
        title="AI Crawler Check"
        sub="Whether each answer engine can actually fetch your pages — the difference between being cited and being invisible."
        aside={
          <a
            href="#robots"
            className="rounded-full border border-line px-4 py-2 font-mono text-[0.62rem] uppercase tracking-widest text-mist transition-colors hover:border-line-strong hover:text-chalk"
          >
            View robots.txt
          </a>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {crawlerKpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} delta={k.delta} unit={k.unit} hint={k.hint} invert={k.invert} />
        ))}
      </div>

      <Panel className="mt-6" title="Bot access matrix" sub="Rules parsed from robots.txt, confirmed with a live fetch">
        <CrawlerBots />
      </Panel>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel title="robots.txt" sub="The blocking rule sits at the top — every bot below inherits it">
          <pre
            id="robots"
            className="overflow-x-auto rounded-xl border border-line bg-black/40 p-4 font-mono text-[0.7rem] leading-relaxed text-mist"
          >
            {robotsSnippet.split("\n").map((line, i) => {
              const inGptBlock = i <= 1; // "User-agent: GPTBot" + its Disallow
              const cls = inGptBlock
                ? "text-coral"
                : line.startsWith("User-agent")
                  ? "text-iris"
                  : line.startsWith("Allow")
                    ? "text-mint"
                    : line.startsWith("Sitemap")
                      ? "text-aqua"
                      : "";
              return (
                <div key={i} className={cls}>
                  {line || "\u00A0"}
                </div>
              );
            })}
          </pre>
          <div className="mt-4 rounded-xl border border-coral/40 bg-coral/[0.07] p-4">
            <p className="text-sm text-coral">The blanket GPTBot disallow removes you from ChatGPT training data entirely.</p>
            <p className="mt-1.5 text-xs leading-relaxed text-mist">
              ChatGPT&apos;s <em>search</em> path (OAI-SearchBot) is still allowed, so you appear in answers today — but a
              single targeted edit future-proofs you if OpenAI routes retrieval through GPTBot.
            </p>
          </div>
        </Panel>

        <Panel title="Page access sample" sub="Fetched with each bot's real user-agent">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line-strong font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                  <th className="pb-3 pr-4 font-normal">Page</th>
                  <th className="pb-3 pr-4 font-normal">Code</th>
                  <th className="pb-3 pr-3 font-normal">GPTBot</th>
                  <th className="pb-3 pr-3 font-normal">Search</th>
                  <th className="pb-3 pr-3 font-normal">Perplexity</th>
                  <th className="pb-3 font-normal">Google-Ext</th>
                </tr>
              </thead>
              <tbody>
                {crawlSamples.map((p) => (
                  <tr key={p.path} className="border-b border-line/70 transition-colors hover:bg-surface-1">
                    <td className="py-3 pr-4">
                      <span className="text-chalk">{p.path}</span>
                      {!p.indexable && (
                        <span className="ml-2 rounded-full border border-gold/40 bg-gold/10 px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest text-gold">
                          noindex
                        </span>
                      )}
                      <span className="mt-0.5 block font-mono text-[0.55rem] text-mist-dim">{p.title}</span>
                    </td>
                    <td className={`py-3 pr-4 font-mono text-xs ${p.code === 200 ? "text-mint" : "text-coral"}`}>
                      {p.code}
                    </td>
                    {(["GPTBot", "OAI-SearchBot", "PerplexityBot", "Google-Extended"] as const).map((bot) => (
                      <td key={bot} className={`py-3 pr-3 font-mono text-[0.62rem] ${engineStatusStyles[p.engines[bot]]}`}>
                        {p.engines[bot]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 font-mono text-[0.62rem] text-mist-dim">
            /resources/* fails every bot — a wildcard rule from the March migration is still live (see Site Audit →
            critical issues).
          </p>
        </Panel>
      </div>

      <Panel
        className="mt-6"
        title="Blocked access — hand off to fix"
        sub={`${crawlerWeaknesses.length} crawler ${crawlerWeaknesses.length === 1 ? "finding" : "findings"} blocking an engine. The fix itself lives in Site Audit.`}
        aside={
          <Link
            href="/dashboard/audit"
            className="font-mono text-[0.62rem] text-mist transition-colors hover:text-chalk"
          >
            fix in site audit →
          </Link>
        }
      >
        <ul className="divide-y divide-line">
          {crawlerWeaknesses.map((w) => (
            <li key={w.title} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <span className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-full border border-coral/40 bg-coral/10 px-2.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-coral">
                  Blocked
                </span>
                <span className="text-sm text-chalk">{w.title}</span>
              </span>
              <span className="font-mono text-[0.62rem] text-mist-dim">
                {w.pages} page{w.pages > 1 ? "s" : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-mist-dim">
          This page reports access. Open Site Audit to work the fix — each finding pairs the weakness with the exact
          robots.txt rule to add.
        </p>
      </Panel>
    </>
  );
}
