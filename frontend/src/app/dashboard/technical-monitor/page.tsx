"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { mergeAudit } from "@/lib/workspace-data";

export default function TechnicalMonitorPage() {
  const { data } = useWorkspaceData();
  const audit = mergeAudit(data);

  const critical = audit.issues.filter((i) => i.severity === "Critical").length;
  const warnings = audit.issues.filter((i) => i.severity === "Warning").length;
  const notices = audit.issues.filter((i) => i.severity === "Notice").length;

  const tiles = [
    { label: "Critical issues", value: `${critical}`, tone: "text-coral" },
    { label: "Warnings", value: `${warnings}`, tone: "text-gold" },
    { label: "Notices", value: `${notices}`, tone: "text-aqua" },
    { label: "Pages checked", value: `${audit.checks}`, tone: "text-chalk" },
  ];

  return (
    <div className="space-y-6">
      <Panel title="Technical Issue Monitor" sub="Tracks broken pages, redirects, metadata, and other technical issues">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Run Full Check</Button>
            <Button variant="secondary">View History</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
                <p className="text-sm text-mist">{t.label}</p>
                <p className={`mt-2 text-3xl font-semibold ${t.tone}`}>{t.value}</p>
              </div>
            ))}
          </div>

          {audit.issues.length === 0 ? (
            <EmptyState
              title="No technical issues recorded"
              sub="Run a full check and every issue it finds is listed here with its severity and the pages it affects."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Issue</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Severity</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Pages</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Fix</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.issues.map((issue) => (
                    <tr key={issue.title} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk">{issue.title}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest ${
                            issue.severity === "Critical"
                              ? "bg-coral/15 text-coral border-coral/30"
                              : issue.severity === "Warning"
                                ? "bg-gold/15 text-gold border-gold/30"
                                : "bg-aqua/15 text-aqua border-aqua/30"
                          }`}
                        >
                          {issue.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-chalk">{issue.pages}</td>
                      <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">{issue.fix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
