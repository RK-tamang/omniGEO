import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function CompetitorPagesPage() {
  return (
    <div className="space-y-6">
      <Panel title="Competitor Page Analyzer" sub="Analyzes specific pages associated with competitor mentions — reverse-engineer their strategy">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Pages</Button>
            <Button variant="secondary">Add URL</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Competitor</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Pages Analyzed</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Top Page</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Citations</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Strategy</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Competitor A</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">47</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk truncate max-w-xs">/blog/ai-crm-guide</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">23</td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">Deep guides, FAQ sections, comparison tables</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Competitor B</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">32</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk truncate max-w-xs">/resources/crm-comparison</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">18</td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">Comparison tables, FAQ schema, video embeds</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Competitor C</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">28</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk truncate max-w-xs">/academy/crm-basics</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">15</td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">Educational content, video tutorials, certifications</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}