import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function SchemaPage() {
  return (
    <div className="space-y-6">
      <Panel title="Schema Markup Validator" sub="Checks relevant structured data — Organization, Article, Product, FAQ, LocalBusiness">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Validate Schema</Button>
            <Button variant="secondary">Generate Schema</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Page</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Schema Types</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Errors</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Last Checked</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">Homepage</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">Organization, WebSite</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">valid</span></td>
                  <td className="px-4 py-3 text-center text-sm text-mist">0</td>
                  <td className="px-4 py-3 text-sm text-mist">2 hours ago</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">/blog/ai-visibility-guide</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">Article, FAQPage</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">valid</span></td>
                  <td className="px-4 py-3 text-center text-sm text-mist">0</td>
                  <td className="px-4 py-3 text-sm text-mist">1 day ago</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">/products/crm-software</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">Product, FAQPage</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">warnings</span></td>
                  <td className="px-4 py-3 text-center text-sm text-mist">2</td>
                  <td className="px-4 py-3 text-sm text-mist">3 days ago</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}