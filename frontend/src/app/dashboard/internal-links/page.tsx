import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function InternalLinksPage() {
  return (
    <div className="space-y-6">
      <Panel title="Internal Linking Analyzer" sub="Identifies relevant internal linking gaps and orphan pages">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Links</Button>
            <Button variant="secondary">Find Orphans</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Total Pages</p>
              <p className="mt-2 text-3xl font-semibold text-chalk">234</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Orphan Pages</p>
              <p className="mt-2 text-3xl font-semibold text-coral">23</p>
              <p className="mt-1 text-xs text-coral font-mono">-3 this week</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Avg Links/Page</p>
              <p className="mt-2 text-3xl font-semibold text-chalk">4.2</p>
              <p className="mt-1 text-xs text-mint font-mono">+0.3 vs last week</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Link Gaps Found</p>
              <p className="mt-2 text-3xl font-semibold text-gold">47</p>
              <p className="mt-1 text-xs text-gold font-mono">+5 this week</p>
            </div>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Orphan Page</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Type</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Potential Links</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Priority</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">/features/legacy-feature</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-purple/15 text-purple border-purple/30">Feature</span></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">8</td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">High</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">/blog/old-seo-tips</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-aqua/15 text-aqua border-aqua/30">Blog</span></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">12</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">Medium</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">/products/deprecated-tool</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-purple/15 text-purple border-purple/30">Product</span></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">5</td>
                  <td className="px-4 py-3 text-center"><span className="text-mist text-sm">Low</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}