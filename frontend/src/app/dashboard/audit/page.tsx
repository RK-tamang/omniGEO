import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Bars, DonutGauge } from "@/components/dashboard/charts";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { IssuesList } from "@/components/dashboard/issues-list";
import { EmptyState } from "@/components/ui/empty-state";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendFetch } from "@/lib/api-client";
import { mergeAudit } from "@/lib/workspace-data";

export const metadata: Metadata = { title: "Site Audit" };

export default async function AuditPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  const result = await backendFetch<any>("/api/workspace/data", {
    method: "GET",
    headers: session?.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
  });

  const data = result.ok && result.data ? result.data : null;
  const domain = data?.domains?.[0]?.domain ?? "your domain";
  const audit = mergeAudit(data);

  const critical = audit.issues.filter((i) => i.severity === "Critical").length;
  const warnings = audit.issues.filter((i) => i.severity === "Warning").length;

  return (
    <>
      <DashboardHeader
        title="Site Audit"
        sub={`Crawlability, structure and AI-readiness for ${domain} — including whether answer-engine bots can actually read you.`}
      />

      {audit.checks === 0 && audit.issues.length === 0 ? (
        <Panel title="Site Audit" sub="Nothing has been audited yet" level={2}>
          <EmptyState
            title="No audit has run yet"
            sub="Run a site audit against your domain and every check, score and weakness it finds will appear here."
          />
        </Panel>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel
              title="Health score"
              sub={audit.ranAt ? `Last run ${audit.ranAt} · ${audit.passed}/${audit.checks} checks passed` : "No checks recorded yet"}
              level={2}
            >
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

            <Panel title="Category scores" sub="Weighted towards AI readiness" className="lg:col-span-2" level={2}>
              {audit.categories.length === 0 ? (
                <EmptyState title="No category scores yet" sub="Categories appear once an audit records its checks." />
              ) : (
                <>
                  <Bars
                    items={audit.categories.map((c) => ({
                      label: c.name,
                      value: c.score,
                      display: `${c.score}`,
                      color: c.score >= 85 ? "#5fb98a" : c.score >= 75 ? "#d9a441" : "#dc6e72",
                    }))}
                  />
                  <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-mist">
                    Each score is the share of that category&apos;s checks that passed on the most recent audit.
                  </p>
                </>
              )}
            </Panel>
          </div>

          <Panel className="mt-6" title="Issues — and how to fix each" sub="Expand any issue for context and the fix" level={2}>
            <IssuesList issues={audit.issues} />
          </Panel>
        </>
      )}
    </>
  );
}
