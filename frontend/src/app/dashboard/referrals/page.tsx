import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function ReferralsPage() {
  return (
    <div className="space-y-6">
      <Panel title="AI Referral Analytics" sub="Track traffic referred by AI platforms where measurable (UTM, referrer headers)">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Referral Sessions</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-chalk">1,234</span>
                <span className="text-sm text-mist">this month</span>
              </div>
              <p className="mt-3 text-xs text-mint font-mono">+12% vs last month</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Conversion Rate</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-chalk">3.2%</span>
              </div>
              <p className="mt-3 text-xs text-coral font-mono">-0.4% vs last month</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Revenue Attributed</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-chalk">₹2.4L</span>
              </div>
              <p className="mt-3 text-xs text-mint font-mono">+18% vs last month</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Avg Session Duration</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-chalk">4m 32s</span>
              </div>
              <p className="mt-3 text-xs text-mist-dim">+15s vs last month</p>
            </div>
          </div>

          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Source</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Sessions</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Conversions</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Revenue</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">ChatGPT</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">892</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">42</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">₹1.2L</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Perplexity</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">456</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">18</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">₹48K</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Gemini</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">234</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">8</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">₹22K</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">AI Overviews</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">1,102</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">31</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">₹89K</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}