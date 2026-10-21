import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function SentimentPage() {
  return (
    <div className="space-y-6">
      <Panel title="Sentiment Analyzer" sub="Classify positive, neutral, and negative brand mentions in AI answers">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Sentiment</Button>
            <Button variant="secondary">View Trends</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-mint/15 border border-mint/30 rounded-2xl p-5 text-center">
              <p className="text-sm text-mint">Positive</p>
              <p className="mt-2 text-3xl font-semibold text-mint">68%</p>
              <p className="mt-1 text-xs text-mint-dim">+5% vs last month</p>
            </div>
            <div className="bg-gold/15 border border-gold/30 rounded-2xl p-5 text-center">
              <p className="text-sm text-gold">Neutral</p>
              <p className="mt-2 text-3xl font-semibold text-gold">22%</p>
              <p className="mt-1 text-xs text-gold-dim">-2% vs last month</p>
            </div>
            <div className="bg-coral/15 border border-coral/30 rounded-2xl p-5 text-center">
              <p className="text-sm text-coral">Negative</p>
              <p className="mt-2 text-3xl font-semibold text-coral">10%</p>
              <p className="mt-1 text-xs text-coral-dim">-3% vs last month</p>
            </div>
          </div>

          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Engine</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Positive</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Neutral</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Negative</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">ChatGPT</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">72%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">18%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">10%</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Perplexity</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">65%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">25%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">10%</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Gemini</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">58%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">30%</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">12%</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}