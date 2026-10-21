import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function BrandMentionsPage() {
  return (
    <div className="space-y-6">
      <Panel title="Brand Mention Monitor" sub="Find direct and indirect brand mentions across all AI answer engines">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Run Mention Scan</Button>
            <Button variant="secondary">Configure Alerts</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Engine</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Mentions</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Sentiment</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">ChatGPT</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">23</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">Positive</span></td>
                  <td className="px-4 py-3 text-center text-sm text-mist">2 hours ago</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Perplexity</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">18</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">Neutral</span></td>
                  <td className="px-4 py-3 text-center text-sm text-mist">5 hours ago</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Gemini</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">12</td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">Mixed</span></td>
                  <td className="px-4 py-3 text-center text-sm text-mist">1 day ago</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}