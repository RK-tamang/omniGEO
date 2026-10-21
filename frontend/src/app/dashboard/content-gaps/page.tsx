import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function ContentGapsPage() {
  return (
    <div className="space-y-6">
      <Panel title="Content Gap Analyzer" sub="Identifies topics your site doesn't cover adequately vs. competitors">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Gaps</Button>
            <Button variant="secondary">Export Report</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Topic Gap</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Competitor Coverage</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Your Coverage</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Gap Size</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Priority</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">AI CRM implementation guide</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">95%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">0%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">Large</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">Urgent</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">CRM data migration checklist</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">85%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">0%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">Large</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">Urgent</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">CRM ROI calculator</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">78%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">0%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">Large</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">High</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">CRM vs spreadsheet comparison</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">72%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">0%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">Medium</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">High</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}