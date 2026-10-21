import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function AnswerHistoryPage() {
  return (
    <div className="space-y-6">
      <Panel title="AI Answer History" sub="Stores and compares past AI responses &mdash; tracks changes over time">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="secondary">Export History</Button>
            <Button>Run Comparison</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface_1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Prompt</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Engine</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Date</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Change</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Preview</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface_1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">best CRM for small business</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">ChatGPT</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">2 days ago</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">+2 citations</span></td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">&ldquo;HubSpot leads with 32% market share...&rdquo;</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface_1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">AI search visibility guide</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">Perplexity</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">5 days ago</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">No change</span></td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">&ldquo;Key factors: content freshness, entity clarity...&rdquo;</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}