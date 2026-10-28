import type { Metadata } from "next";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { backendFetch } from "@/lib/api-client";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { mergeActivity } from "@/lib/workspace-data";

export const metadata: Metadata = { title: "Scheduled Checks" };

export default async function ScheduledChecksPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  const result = await backendFetch<any>("/api/workspace/data", {
    method: "GET",
    headers: session?.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
  });

  const data = result.ok && result.data ? result.data : null;
  const settings = data?.workspace?.settings ?? null;

  const scans: { createdAt?: number | string; status?: string }[] = (data?.scans ?? [])
    .slice()
    .sort((a: { createdAt?: number | string }, b: { createdAt?: number | string }) => (Date.parse(String(b.createdAt ?? 0)) || 0) - (Date.parse(String(a.createdAt ?? 0)) || 0));
  const completed = scans.filter((s) => s.status === "completed").length;
  const failed = scans.filter((s) => s.status === "failed").length;
  const successRate = scans.length ? Math.round(((scans.length - failed) / scans.length) * 100) : 0;

  const tiles = [
    { label: "Runs recorded", value: `${scans.length}`, tone: "text-chalk" },
    { label: "Completed", value: `${completed}`, tone: "text-chalk" },
    { label: "Success rate", value: scans.length ? `${successRate}%` : "—", tone: "text-mint" },
    { label: "Next scheduled", value: settings?.runDay ?? "not set", tone: "text-chalk" },
  ];

  const recent = mergeActivity(data).slice(0, 6);

  return (
    <div className="space-y-6">
      <Panel title="Scheduled Visibility Checks" sub="Daily or scheduled AI visibility checks across all tracked prompts and engines">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Run Check Now</Button>
            <Button variant="secondary">Configure Schedule</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
                <p className="text-sm text-mist">{t.label}</p>
                <p className={`mt-2 text-3xl font-semibold ${t.tone}`}>{t.value}</p>
              </div>
            ))}
          </div>

          {recent.length === 0 ? (
            <EmptyState
              title="No runs recorded yet"
              sub="Every scan this workspace runs is logged here, with its result and when it finished."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Run</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Result</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">When</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r, i) => (
                    <tr key={i} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk">{r.text}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest ${
                            r.tone === "alert"
                              ? "bg-coral/15 text-coral border-coral/30"
                              : r.tone === "win"
                                ? "bg-mint/15 text-mint border-mint/30"
                                : "bg-mist/15 text-mist border-mist/30"
                          }`}
                        >
                          {r.tone}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-mist">{r.time}</td>
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
