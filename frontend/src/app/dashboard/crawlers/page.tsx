import type { Metadata } from "next";
import Link from "next/link";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { CrawlerBots } from "@/components/dashboard/crawler-bots";
import { EmptyState } from "@/components/ui/empty-state";
import { getCrawlerAccess, getWorkspaceData } from "@/server/workspace-data";

export const metadata: Metadata = { title: "AI Crawler Check" };

export default async function CrawlersPage() {
  const [access, data] = await Promise.all([getCrawlerAccess(), getWorkspaceData()]);

  const bots = access?.bots ?? [];
  const allowed = bots.filter((b) => b.status === "allowed").length;
  const blocked = bots.filter((b) => b.status === "blocked").length;
  const limited = bots.filter((b) => b.status === "limited").length;

  const crawls = (data?.crawls ?? [])
    .slice()
    .sort(
      (a, b) =>
        (typeof b.completedAt === "number" ? b.completedAt : Date.parse(String(b.completedAt ?? b.createdAt ?? 0)) || 0) -
        (typeof a.completedAt === "number" ? a.completedAt : Date.parse(String(a.completedAt ?? a.createdAt ?? 0)) || 0),
    )
    .slice(0, 8);

  const kpis = [
    {
      label: "Engines that can read you",
      value: `${allowed}/${bots.length}`,
      delta: 0,
      unit: "bots",
      hint: bots.length ? "From your live robots.txt" : "No robots.txt read yet",
    },
    {
      label: "Bots blocked",
      value: `${blocked}`,
      delta: 0,
      unit: "bots",
      hint: "Cannot reach your pages at all",
    },
    {
      label: "Partly blocked",
      value: `${limited}`,
      delta: 0,
      unit: "bots",
      hint: "Allowed at the root, blocked elsewhere",
    },
    {
      label: "Pages crawled",
      value: `${data?.crawls?.length ?? 0}`,
      delta: 0,
      unit: "pages",
      hint: "Recorded by the crawler engine",
    },
  ];

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
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <Panel className="mt-6" title="Bot access matrix" sub="Rules parsed from your live robots.txt" level={2}>
        <CrawlerBots
          bots={
            bots.length
              ? bots.map((b) => ({ ...b, lastChecked: access?.fetchedAt ? "just now" : "recently" }))
              : undefined
          }
          domain={access?.domain}
        />
      </Panel>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel title="robots.txt" sub="Served by your site right now" level={2}>
          {!access ? (
            <EmptyState title="robots.txt not read yet" sub="Set a domain on the workspace and the check will fetch it." />
          ) : !access.found ? (
            <EmptyState
              title="No robots.txt served"
              sub={
                access.status
                  ? `${access.domain} returned HTTP ${access.status} for /robots.txt. Without one, every crawler is allowed — but you also lose the sitemap pointer.`
                  : `${access.domain} could not be reached, so there is no robots.txt to read. Without one, every crawler is allowed — but you also lose the sitemap pointer.`
              }
            />
          ) : (
            <>
              <pre
                id="robots"
                className="overflow-x-auto rounded-xl border border-line bg-black/40 p-4 font-mono text-[0.7rem] leading-relaxed text-mist"
              >
                {access.body.split("\n").map((line, i) => {
                  const cls = line.startsWith("User-agent")
                    ? "text-iris"
                    : line.startsWith("Allow")
                      ? "text-mint"
                      : line.startsWith("Disallow")
                        ? "text-coral"
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
              {blocked > 0 && (
                <div className="mt-4 rounded-xl border border-coral/40 bg-coral/[0.07] p-4">
                  <p className="text-sm text-coral">
                    {blocked} bot{blocked === 1 ? "" : "s"} cannot reach your pages at all.
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-mist">
                    A blocked search-side bot means those engines cannot retrieve — and therefore cannot cite — you.
                  </p>
                </div>
              )}
            </>
          )}
        </Panel>

        <Panel title="Recent crawls" sub="Pages fetched by the crawler engine" level={2}>
          {crawls.length === 0 ? (
            <EmptyState
              title="Nothing crawled yet"
              sub="Run a crawl and every page fetched — with its status and title — is listed here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line-strong font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                    <th className="pb-3 pr-4 font-normal">Page</th>
                    <th className="pb-3 pr-4 font-normal">Status</th>
                    <th className="pb-3 pr-4 font-normal">Title</th>
                    <th className="pb-3 font-normal">Pages</th>
                  </tr>
                </thead>
                <tbody>
                  {crawls.map((c) => (
                    <tr key={c.id} className="border-b border-line/70 transition-colors hover:bg-surface-1">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs text-chalk">{c.url}</span>
                      </td>
                      <td
                        className={`py-3 pr-4 font-mono text-xs ${
                          c.status === "completed" ? "text-mint" : c.status === "failed" ? "text-coral" : "text-gold"
                        }`}
                      >
                        {c.status}
                      </td>
                      <td className="py-3 pr-4 text-xs text-mist">{c.result?.title ?? "—"}</td>
                      <td className="py-3 font-mono text-xs text-mist">{c.pagesCrawled ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        className="mt-6"
        title="Blocked access — hand off to fix"
        sub={`${blocked} bot${blocked === 1 ? "" : "s"} cannot reach your pages. The fix itself lives in Site Audit.`}
        level={2}
        aside={
          <Link
            href="/dashboard/audit"
            className="font-mono text-[0.62rem] text-mist transition-colors hover:text-chalk">
            fix in site audit →
          </Link>
        }
      >
        {blocked === 0 && limited === 0 ? (
          <EmptyState
            title="Nothing is blocked"
            sub="Every tracked answer engine can read your site right now."
          />
        ) : (
          <ul className="divide-y divide-line">
            {bots
              .filter((b) => b.status !== "allowed")
              .map((b) => (
                <li key={b.bot} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                  <span className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${
                        b.status === "blocked"
                          ? "border-coral/40 bg-coral/10 text-coral"
                          : "border-gold/40 bg-gold/10 text-gold"
                      }`}
                    >
                      {b.status === "blocked" ? "Blocked" : "Partly blocked"}
                    </span>
                    <span className="text-sm text-chalk">{b.bot}</span>
                  </span>
                  <span className="font-mono text-[0.62rem] text-mist-dim">{b.rule ?? "no explicit rule"}</span>
                </li>
              ))}
          </ul>
        )}
        <p className="mt-4 text-xs leading-relaxed text-mist-dim">
          This page reports access. Open Site Audit to work the fix — each finding pairs the weakness with the exact
          robots.txt rule to add.
        </p>
      </Panel>
    </>
  );
}
