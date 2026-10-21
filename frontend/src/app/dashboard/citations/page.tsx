import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function CitationsPage() {
  return (
    <div className="space-y-6">
      <Panel title="AI Citation Tracker" sub="Identify which pages and domains are cited in AI answers for your tracked prompts">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Run Citation Scan</Button>
            <Button variant="secondary">Export Report</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Domain</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Citations</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Prompts</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Top Page</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">northwindlabs.com</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">127</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">42</td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">/blog/ai-visibility-guide</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">docs.northwind.io</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">45</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">12</td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">/docs/getting-started</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}