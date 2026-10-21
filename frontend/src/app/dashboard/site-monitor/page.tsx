import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function SiteMonitorPage() {
  return (
    <div className="space-y-6">
      <Panel title="Website Change Monitoring" sub="Tracks content changes, new pages, deletions, and metadata updates on your site">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Run Scan Now</Button>
            <Button variant="secondary">Configure Rules</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5"><p className="text-sm text-mist">Pages Monitored</p><p className="mt-2 text-3xl font-semibold text-chalk">2,847</p></div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5"><p className="text-sm text-mist">Changes Today</p><p className="mt-2 text-3xl font-semibold text-gold">23</p></div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5"><p className="text-sm text-mist">New Pages</p><p className="mt-2 text-3xl font-semibold text-mint">5</p></div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5"><p className="text-sm text-mist">Deleted Pages</p><p className="mt-2 text-3xl font-semibold text-coral">2</p></div>
          </div>
          <div className="rounded-xl border border-line overflow-hidden"><table className="w-full"><thead><tr className="bg-surface-1 border-b border-line"><th className="px-4 py-3 text-left text-sm font-medium text-mist">Change</th><th className="px-4 py-3 text-center text-sm font-medium text-mist">URL</th><th className="px-4 py-3 text-center text-sm font-medium text-mist">Type</th><th className="px-4 py-3 text-center text-sm font-medium text-mist">Detected</th></tr></thead><tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1"><td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Added</span></td><td className="px-4 py-3 text-sm text-chalk truncate max-w-xs">/blog/new-ai-features</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">New Page</span></td><td className="px-4 py-3 text-center text-sm text-mist">5 min ago</td></tr>
                <tr className="border-b border-line/50 hover:bg-surface-1"><td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-coral/15 text-coral border-coral/30">Deleted</span></td><td className="px-4 py-3 text-sm text-chalk truncate max-w-xs">/products/legacy-tool</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-coral/15 text-coral border-coral/30">Deleted</span></td><td className="px-4 py-3 text-center text-sm text-mist">2 hours ago</td></tr>
                <tr className="border-b border-line/50 hover:bg-surface-1"><td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">Modified</span></td><td className="px-4 py-3 text-sm text-chalk truncate max-w-xs">/products/crm-pro</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">Content</span></td><td className="px-4 py-3 text-center text-sm text-mist">4 hours ago</td></tr></tbody></table></div>
        </div>
      </Panel>
    </div>
  );
}