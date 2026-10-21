import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function TopicalAuthorityPage() {
  return (
    <div className="space-y-6">
      <Panel title="Topical Authority Analyzer" sub="Identifies topic coverage depth, content gaps, and semantic completeness">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Authority</Button>
            <Button variant="secondary">View Gaps</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Topic Cluster</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Coverage</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Depth</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Gap Score</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Priority</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">CRM Software</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">87%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm">Deep</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">Low</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mist text-sm">Maintain</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">AI Search Visibility</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold font-mono text-sm">72%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm">Medium</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold font-mono text-sm">Medium</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm">Improve</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Local SEO for AI</td>
                  <td className="px-4 py-3 text-center"><span className="text-coral font-mono text-sm">45%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm">Shallow</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral font-mono text-sm">High</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm">Urgent</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Schema Markup for AI</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold font-mono text-sm">68%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm">Medium</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold font-mono text-sm">Medium</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm">Improve</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}