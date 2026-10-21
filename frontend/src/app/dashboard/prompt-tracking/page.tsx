import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function PromptTrackingPage() {
  return (
    <div className="space-y-6">
      <Panel title="Prompt Tracking" sub="Monitor a saved set of prompts over time — daily/weekly visibility trends">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Add Prompts to Track</Button>
            <Button variant="secondary">Import from CSV</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Prompt</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Engines</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Frequency</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Last Checked</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Trend</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">best CRM for small business</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">4</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">Daily</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">2 hours ago</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">+2%</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">AI search visibility guide</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">3</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">Weekly</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">1 day ago</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold font-mono text-sm">-1%</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}