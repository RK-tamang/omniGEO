import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function CompetitorCitationsPage() {
  return (
    <div className="space-y-6">
      <Panel title="Citation Source Explorer" sub="Shows websites and pages frequently cited in tracked answers — build your link strategy">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Explore Sources</Button>
            <Button variant="secondary">Export Sources</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Source Domain</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Citations</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Competitors Cited</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Authority</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Top Page</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">github.com</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">234</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">8</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">High</span></td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">/topics/ai-software</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">stackoverflow.com</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">189</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">7</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">High</span></td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">/questions/tagged/crm</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">g2.com</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">156</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">9</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">High</span></td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">/categories/crm</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">capterra.com</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">134</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">8</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">High</span></td>
                  <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">/crm-software</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}