import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function GeoVisibilityPage() {
  return (
    <div className="space-y-6">
      <Panel title="Geographic Visibility Tracker" sub="Compare AI visibility results by market, region, or language">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Run Geo Scan</Button>
            <Button variant="secondary">Compare Regions</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Region</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Visibility Score</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Prompts Tracked</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Top Competitor</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">India (EN)</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">72</span></td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">42</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">Competitor A</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">United States (EN)</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">68</span></td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">38</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">Competitor B</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">United Kingdom (EN)</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">65</span></td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">35</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">Competitor A</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Germany (DE)</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold font-mono text-sm">58</span></td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">28</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">Competitor C</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Japan (JP)</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold font-mono text-sm">52</span></td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">22</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">Competitor D</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}