import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function RobotsPage() {
  return (
    <div className="space-y-6">
      <Panel title="Robots & Crawlability Checker" sub="Checks crawler access, robots.txt, indexing signals, and AI bot permissions">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Check Robots.txt</Button>
            <Button variant="secondary">Test AI Bot Access</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Bot</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">User-Agent</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Access</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Crawl-Delay</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">GPTBot</td>
                  <td className="px-4 py-3 text-center font-mono text-sm text-mist">GPTBot</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-coral/15 text-coral border-coral/30">blocked</span></td>
                  <td className="px-4 py-3 text-center text-sm text-mist">—</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">ChatGPT-User</td>
                  <td className="px-4 py-3 text-center font-mono text-sm text-mist">ChatGPT-User</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">allowed</span></td>
                  <td className="px-4 py-3 text-center text-sm text-mist">—</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">PerplexityBot</td>
                  <td className="px-4 py-3 text-center font-mono text-sm text-mist">PerplexityBot</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">allowed</span></td>
                  <td className="px-4 py-3 text-center text-sm text-mist">10s</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Google-Extended</td>
                  <td className="px-4 py-3 text-center font-mono text-sm text-mist">Google-Extended</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">allowed</span></td>
                  <td className="px-4 py-3 text-center text-sm text-mist">—</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">CCBot</td>
                  <td className="px-4 py-3 text-center font-mono text-sm text-mist">CCBot</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-coral/15 text-coral border-coral/30">blocked</span></td>
                  <td className="px-4 py-3 text-center text-sm text-mist">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}