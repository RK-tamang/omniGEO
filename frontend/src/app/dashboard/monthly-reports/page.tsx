"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";

export default function MonthlyReportsPage() {
  const { data } = useWorkspaceData();
  const reports = (data?.reports ?? []).filter((r) => r.type === "monthly");

  const tiles = [
    { label: "Reports Generated", value: `${reports.length}`, tone: "text-chalk" },
    { label: "Completed", value: `${reports.filter((r) => r.status === "completed").length}`, tone: "text-mint" },
    { label: "White-label", value: `${reports.filter((r) => r.format === "white_label_pdf").length}`, tone: "text-chalk" },
    { label: "Latest", value: reports[0]?.createdAt ? new Date(reports[0].createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—", tone: "text-chalk" },
  ];

  return (
    <div className="space-y-6">
      <Panel title="Monthly Client Report" sub="Comprehensive monthly report with insights, recommendations, and ROI metrics">
        <div className="space-y-4">
          <div className="flex items-center gap-4"><Button>Generate Report</Button><Button variant="secondary">View Archive</Button></div>

          {reports.length === 0 ? (
            <EmptyState
              title="No monthly reports yet"
              sub="Generate a monthly report and it is listed here with its format and status."
            />
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border-l-4 border-gold flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">
                      {r.status}
                    </span>
                    <span className="font-medium text-chalk">{r.name}</span>
                    <span className="font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim">{r.format}</span>
                  </div>
                  <span className="text-xs text-mist-dim">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
                <p className="text-sm text-mist">{t.label}</p>
                <p className={`mt-2 text-3xl font-semibold ${t.tone}`}>{t.value}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
