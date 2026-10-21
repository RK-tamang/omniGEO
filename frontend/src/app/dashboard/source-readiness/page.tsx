import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function SourceReadinessPage() {
  return (
    <div className="space-y-6">
      <Panel title="Source & Citation Readiness" sub="Evaluates whether important claims are clear, verifiable, and citation-ready">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Check Readiness</Button>
            <Button variant="secondary">Generate Report</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Claims Analyzed</p>
              <p className="mt-2 text-3xl font-semibold text-chalk">1,247</p>
              <p className="mt-1 text-xs text-mint font-mono">+127 this week</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Citation-Ready</p>
              <p className="mt-2 text-3xl font-semibold text-chalk">68%</p>
              <p className="mt-1 text-xs text-mint font-mono">+5% vs last week</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Unverified Claims</p>
              <p className="mt-2 text-3xl font-semibold text-coral">398</p>
              <p className="mt-1 text-xs text-coral font-mono">+23 this week</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Avg Sources/Claim</p>
              <p className="mt-2 text-3xl font-semibold text-chalk">2.3</p>
              <p className="mt-1 text-xs text-mint font-mono">+0.2 vs last week</p>
            </div>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Page</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Claims</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Verified</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Unverified</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Readiness</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">Best CRM for Small Business 2024</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">12</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">9</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">3</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">75%</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">AI Search Visibility Guide</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">8</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">5</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">3</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">62%</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">Schema Markup for Local SEO</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">5</td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">1</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">4</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">20%</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}