import type { Metadata } from "next";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { ContentTable } from "@/components/dashboard/content-table";
import { getWorkspaceData } from "@/server/workspace-data";
import { mergeContentItems, mergeContentKpis } from "@/lib/workspace-data";

export const metadata: Metadata = { title: "Content Studio" };

const checklist = [
  "Every knowledge claim traces to a source",
  "First 80 words answer the title question",
  "One table, list or definition to lift cleanly",
  "Named author with role and credentials",
  "Internal links to the supporting pages",
];

export default async function ContentPage() {
  const data = await getWorkspaceData();
  const contentItems = mergeContentItems(data);
  const contentKpis = mergeContentKpis(data);
  const avgScore = contentItems.length
    ? Math.round(contentItems.reduce((sum, c) => sum + c.score, 0) / contentItems.length)
    : 0;

  return (
    <>
      <DashboardHeader
        title="Content Studio"
        sub="Drafts scored for citation-readiness: claim → source → structure, checked before publish."
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {contentKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Panel title="Citation-ready checklist" sub="Run against every draft before publish" className="lg:col-span-2" level={2}>
          <ul className="space-y-3">
            {checklist.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-0.5 shrink-0">
                  <rect x="1.5" y="1.5" width="13" height="13" rx="4" stroke="rgba(62,124,176,0.5)" />
                  <path d="M4.5 8l2.5 2.5L11.5 5.5" stroke="#5fb98a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-mist">{item}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Where drafts stand" sub={contentItems.length ? `Average score ${avgScore}` : "No drafts yet"} level={2}>
          {contentItems.length === 0 ? (
            <p className="text-sm text-mist">
              Nothing to summarise yet. Generate your first draft and each piece is scored and counted here.
            </p>
          ) : (
            <>
              <ul className="space-y-4">
                {(["Published", "In review", "Draft"] as const).map((status) => {
                  const items = contentItems.filter((c) => c.status === status);
                  const avg = items.length ? Math.round(items.reduce((s, c) => s + c.score, 0) / items.length) : 0;
                  return (
                    <li key={status}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="text-mist">{status}</span>
                        <span className="font-mono text-xs text-chalk">
                          {items.length} pieces · avg {avg}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-iris to-aqua"
                          style={{ width: `${avg}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-mist">
                Lowest-scoring pieces are listed below — fix the source of their opening claim first.
              </p>
            </>
          )}
        </Panel>
      </div>

      <Panel className="mt-6" title="All pieces" sub="Score = citation-readiness (sources, structure, clarity)" level={2}>
        <ContentTable items={contentItems} />
      </Panel>
    </>
  );
}
