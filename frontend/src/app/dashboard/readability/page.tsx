import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function ReadabilityPage() {
  return (
    <div className="space-y-6">
      <Panel title="Content Readability Analyzer" sub="Checks clarity, structure, direct answers, and citation-ready formatting">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Readability</Button>
            <Button variant="secondary">Batch Check</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Avg Readability</p>
              <p className="mt-2 text-3xl font-semibold text-chalk">72/100</p>
              <p className="mt-1 text-xs text-mint font-mono">+3 vs last week</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Pages Analyzed</p>
              <p className="mt-2 text-3xl font-semibold text-chalk">234</p>
              <p className="mt-1 text-xs text-mint font-mono">+12 this week</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Pass Rate</p>
              <p className="mt-2 text-3xl font-semibold text-chalk">78%</p>
              <p className="mt-1 text-xs text-mint font-mono">+5% vs last week</p>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
              <p className="text-sm text-mist">Citation-Ready</p>
              <p className="mt-2 text-3xl font-semibold text-chalk">65%</p>
              <p className="mt-1 text-xs text-gold font-mono">+8% vs last week</p>
            </div>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Page</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Score</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Clarity</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Structure</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Citation-Ready</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">Best CRM for Small Business 2024</td>
                  <td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">87</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm">92</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-mint text-sm">85</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm">72</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">AI Search Visibility Guide</td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm">74</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm">78</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-gold text-sm">70</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm">60</span></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">Schema Markup for Local SEO</td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm">58</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm">62</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm">55</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-coral text-sm">50</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}