import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function FaqPage() {
  return (
    <div className="space-y-6">
      <Panel title="FAQ Optimization Tool" sub="Finds unanswered questions, FAQ opportunities, and People Also Ask gaps">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Find FAQ Gaps</Button>
            <Button variant="secondary">Generate FAQs</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Question</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Search Volume</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Difficulty</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Current Answer</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Opportunity</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">What is the best CRM for small business?</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">12,000/mo</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">Medium</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">Missing</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">High</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">How much does CRM software cost?</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">8,500/mo</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">Medium</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">Partial</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">Medium</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">What features should a CRM have?</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">5,200/mo</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">Medium</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">Partial</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">Medium</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}