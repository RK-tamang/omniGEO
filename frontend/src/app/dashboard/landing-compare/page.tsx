import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function LandingComparePage() {
  return (
    <div className="space-y-6">
      <Panel title="Landing Page Comparison" sub="A/B tests GEO-optimized vs. original — measures citation lift and visibility delta">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Create Test</Button>
            <Button variant="secondary">View Results</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Test Name</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Variant A (Original)</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Variant B (GEO-Optimized)</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Citation Lift</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Best CRM Landing Page</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">8 cites</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">14 cites</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">+75%</span></td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Winner: B</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">AI Visibility Features</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold font-mono text-sm">3 cites</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">7 cites</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">+133%</span></td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Winner: B</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Pricing Page A/B</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">5 cites</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold font-mono text-sm">4 cites</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral font-mono text-sm">-20%</span></td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-coral/15 text-coral border-coral/30">Winner: A</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}