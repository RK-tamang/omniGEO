import type { Metadata } from "next";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCrawlerAccess } from "@/server/workspace-data";

export const metadata: Metadata = { title: "Robots & Crawlability" };

const accessStyles = {
  allowed: "bg-mint/15 text-mint border-mint/30",
  limited: "bg-gold/15 text-gold border-gold/30",
  blocked: "bg-coral/15 text-coral border-coral/30",
} as const;

export default async function RobotsPage() {
  const access = await getCrawlerAccess();
  const bots = access?.bots ?? [];

  return (
    <div className="space-y-6">
      <Panel title="Robots & Crawlability Checker" sub="Checks crawler access, robots.txt, indexing signals, and AI bot permissions">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Check Robots.txt</Button>
            <Button variant="secondary">Test AI Bot Access</Button>
          </div>

          {bots.length === 0 ? (
            <EmptyState
              title="No robots.txt read yet"
              sub={
                access?.found === false
                  ? `${access.domain} is not serving a robots.txt. Without one every crawler is allowed, but you also lose the sitemap pointer.`
                  : "Set a domain on the workspace and the check reads its live robots.txt."
              }
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Bot</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">User-Agent</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Access</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Rule</th>
                  </tr>
                </thead>
                <tbody>
                  {bots.map((b) => (
                    <tr key={b.bot} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk">{b.bot}</td>
                      <td className="px-4 py-3 text-center font-mono text-sm text-mist">{b.bot}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest ${accessStyles[b.status]}`}
                        >
                          {b.status === "limited" ? "partly blocked" : b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-mist">{b.rule ?? "—"}</td>
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
