import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function PageOptimizerPage() {
  return (
    <div className="space-y-6">
      <Panel title="Existing Page Optimizer" sub="Rewrites existing pages for AI citation readiness — adds claims, sources, FAQs, schema">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mist mb-2">Page URL or Content</label>
            <textarea
              placeholder="Paste your page URL or paste content here..."
              className="w-full min-h-[100px] rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-4">
            <Button>Optimize Page</Button>
            <Button variant="secondary">Preview Changes</Button>
          </div>
          <p className="text-xs text-mist-dim">Cost: ~$0.002 per optimization • Fix limits: Starter 5, Pro 20, Enterprise 50/mo</p>

          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Page</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Before</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">After</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Citations Added</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">Best CRM for Small Business 2024</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">completed</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold font-mono text-sm">74</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">87</span></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">+12</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">AI Search Visibility Guide</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-aqua/15 text-aqua border-aqua/30">in progress</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold font-mono text-sm">74</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">—</span></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">—</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">Schema Markup for Local SEO</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">queued</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral font-mono text-sm">58</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">—</span></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}