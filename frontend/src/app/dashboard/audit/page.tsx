import type { Metadata } from "next";
import { Bars, DonutGauge } from "@/components/dashboard/charts";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { IssuesList } from "@/components/dashboard/issues-list";
import { audit } from "@/lib/dashboard-data";
import { getSettings, primaryDomain } from "@/server/db";

export const metadata: Metadata = { title: "Site Audit" };

export default function AuditPage() {
  const domain = primaryDomain(getSettings());
  const critical = audit.issues.filter((i) => i.severity === "Critical").length;
  const warnings = audit.issues.filter((i) => i.severity === "Warning").length;

  return (
    <>
      <DashboardHeader
        title="Site Audit"
        sub={`Crawlability, structure and AI-readiness for ${domain} — including whether answer-engine bots can actually read you.`}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Health score" sub={`Last run 2 days ago · ${audit.passed}/${audit.checks} checks passed`}>
          <DonutGauge value={audit.score} label="health" />
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-center">
            <div>
              <p className="font-mono text-xl text-coral">{critical}</p>
              <p className="font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">critical</p>
            </div>
            <div>
              <p className="font-mono text-xl text-gold">{warnings}</p>
              <p className="font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">warnings</p>
            </div>
          </div>
        </Panel>

        <Panel title="Category scores" sub="Weighted towards AI readiness" className="lg:col-span-2">
          <Bars
            items={audit.categories.map((c) => ({
              label: c.name,
              value: c.score,
              display: `${c.score}`,
              color: c.score >= 85 ? "#34d399" : c.score >= 75 ? "#fbbf24" : "#fb7185",
            }))}
          />
          <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-mist">
            AI readiness lags the rest because GPTBot is blocked on twelve resource pages and the homepage is missing
            Organization schema. Both are quick wins.
          </p>
        </Panel>
      </div>

      <Panel className="mt-6" title="Issues — and how to fix each" sub="Expand any issue for context and the fix">
        <IssuesList />
      </Panel>
    </>
  );
}
