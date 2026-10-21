import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function RefreshRecommenderPage() {
  return (
    <div className="space-y-6">
      <Panel title="Content Refresh Recommender" sub="Identifies stale content, declining visibility, and prioritizes updates by ROI">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Content</Button>
            <Button variant="secondary">Schedule Refresh</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Page</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Last Updated</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Visibility Trend</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">ROI Score</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">Best CRM for Small Business 2024</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">2 months ago</td>
                  <td className="px-4 py-3 text-center"><span className="text-coral font-mono text-sm">-12%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral font-mono text-sm">High</span></td>
                  <td className="px-4 py-3 text-center"><Button size="sm" variant="secondary">Refresh</Button></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">AI Search Visibility Guide</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">1 month ago</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold font-mono text-sm">-5%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold font-mono text-sm">Medium</span></td>
                  <td className="px-4 py-3 text-center"><Button size="sm" variant="secondary">Refresh</Button></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">Schema Markup for Local SEO</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">3 months ago</td>
                  <td className="px-4 py-3 text-center"><span className="text-coral font-mono text-sm">-18%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral font-mono text-sm">High</span></td>
                  <td className="px-4 py-3 text-center"><Button size="sm" variant="secondary">Refresh</Button></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">AI Search Visibility Guide</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">2 weeks ago</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">+8%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">Low</span></td>
                  <td className="px-4 py-3 text-center"><Button size="sm" variant="ghost">Monitor</Button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}