import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function EntitiesPage() {
  return (
    <div className="space-y-6">
      <Panel title="Entity Optimization Analyzer" sub="Reviews brand, product, and organization entity consistency across pages">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Entities</Button>
            <Button variant="secondary">Export Report</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Entity</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Type</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Consistency</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Pages Found</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Issues</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Northwind Labs</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-aqua/15 text-aqua border-aqua/30">Organization</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">94%</span></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">42</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">2</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">CRM Software</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-purple/15 text-purple border-purple/30">Product</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">78%</span></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">28</td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">5</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Aarav Mehta</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-pink/15 text-pink border-pink/30">Person</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">91%</span></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">15</td>
                  <td className="px-4 py-3 text-center"><span className="text-mist text-sm">0</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}