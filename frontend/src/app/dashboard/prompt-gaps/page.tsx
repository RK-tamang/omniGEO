import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function PromptGapsPage() {
  return (
    <div className="space-y-6">
      <Panel title="Competitor Prompt Gap Finder" sub="Identifies questions competitors win that you don't — your content opportunities">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Find Gaps</Button>
            <Button variant="secondary">Export Opportunities</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Prompt Gap</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Competitor</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Engine</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Volume</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Difficulty</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">how to choose CRM for startup</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">Competitor A</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">ChatGPT</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">8,500/mo</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">Medium</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">CRM pricing comparison 2024</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">Competitor B</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">Perplexity</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">12,000/mo</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">Medium</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">best AI CRM tools 2024</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">Competitor C</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">ChatGPT</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">5,200/mo</td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">High</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}