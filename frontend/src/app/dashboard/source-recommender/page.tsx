import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function SourceRecommenderPage() {
  return (
    <div className="space-y-6">
      <Panel title="Statistics & Source Recommender" sub="Finds credible statistics, studies, and sources to back your claims — auto-links">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mist mb-2">Your Claim / Topic</label>
            <textarea placeholder="e.g., CRM software increases sales productivity by 30%" className="w-full min-h-[80px] rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors" rows={2} />
          </div>
          <div className="flex items-center gap-4">
            <Button>Find Sources</Button>
            <Button variant="secondary">Verify Claims</Button>
          </div>
          <p className="text-xs text-mist-dim">Finds credible statistics, studies, and authoritative sources — auto-generates citations</p>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Recommended Source</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Type</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Authority</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Relevance</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">URL</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Nucleus Research - CRM ROI Study</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-purple/15 text-purple border-purple/30">Study</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">High</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">95%</span></td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">nucleusresearch.com/crm-roi</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Gartner Magic Quadrant CRM</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-purple/15 text-purple border-purple/30">Report</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">High</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">92%</span></td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">gartner.com/mq/crm</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Forrester Wave CRM 2024</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-purple/15 text-purple border-purple/30">Report</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">High</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">88%</span></td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">forrester.com/wave/crm</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}