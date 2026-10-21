import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function TechnicalMonitorPage() {
  return (
    <div className="space-y-6">
      <Panel title="Technical Issue Monitor" sub="Tracks broken pages, redirects, metadata, and other technical issues">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Run Full Check</Button>
            <Button variant="secondary">View History</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Critical Issues</p>
              <p className="mt-2 text-3xl font-semibold text-coral">3</p>
              <p className="mt-1 text-xs text-coral font-mono">+1 vs yesterday</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Warnings</p>
              <p className="mt-2 text-3xl font-semibold text-gold">12</p>
              <p className="mt-1 text-xs text-gold font-mono">-2 vs yesterday</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Notices</p>
              <p className="mt-2 text-3xl font-semibold text-aqua">28</p>
              <p className="mt-1 text-xs text-aqua font-mono">-1 vs yesterday</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Pages Checked</p>
              <p className="mt-2 text-3xl font-semibold text-chalk">2,847</p>
              <p className="mt-1 text-xs text-mint font-mono">+47 today</p>
            </div>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Issue</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Severity</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Pages</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Example URL</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">404 Not Found</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-coral/15 text-coral border-coral/30">Critical</span></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">3</td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">/products/old-version</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Redirect Chain</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">Warning</span></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">12</td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">/blog/old-post → /blog/new-post → /blog/latest</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Missing Meta Description</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-aqua/15 text-aqua border-aqua/30">Notice</span></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">45</td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">/products/*</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}