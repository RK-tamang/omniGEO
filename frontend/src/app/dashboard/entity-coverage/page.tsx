import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function EntityCoveragePage() {
  return (
    <div className="space-y-6">
      <Panel title="Entity & Topic Coverage Checker" sub="Verifies your content covers all key entities, topics, and semantic relationships">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Check Coverage</Button>
            <Button variant="secondary">View Details</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5"><p className="text-sm text-mist">Entities Tracked</p><p className="mt-2 text-3xl font-semibold text-chalk">47</p><p className="mt-1 text-xs text-mint font-mono">+5 this week</p></div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5"><p className="text-sm text-mist">Coverage Score</p><p className="mt-2 text-3xl font-semibold text-chalk">82%</p><p className="mt-1 text-xs text-mint font-mono">+4% vs last week</p></div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5"><p className="text-sm text-mist">Topics Covered</p><p className="mt-2 text-3xl font-semibold text-chalk">23/28</p><p className="mt-1 text-xs text-gold font-mono">5 gaps found</p></div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5"><p className="text-sm text-mist">Semantic Depth</p><p className="mt-2 text-3xl font-semibold text-chalk">78%</p><p className="mt-1 text-xs text-mint font-mono">+3% vs last week</p></div>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full"><thead><tr className="bg-surface-1 border-b border-line"><th className="px-4 py-3 text-left text-sm font-medium text-mist">Entity / Topic</th><th className="px-4 py-3 text-center text-sm font-medium text-mist">Type</th><th className="px-4 py-3 text-center text-sm font-medium text-mist">Coverage</th><th className="px-4 py-3 text-center text-sm font-medium text-mist">Relationships</th><th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th></tr></thead><tbody>
              <tr className="border-b border-line/50 hover:bg-surface-1"><td className="px-4 py-3 font-medium text-chalk">Northwind Labs</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-aqua/15 text-aqua border-aqua/30">Organization</span></td><td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">94%</span></td><td className="px-4 py-3 text-center font-mono text-chalk">42</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Complete</span></td></tr>
              <tr className="border-b border-line/50 hover:bg-surface-1"><td className="px-4 py-3 font-medium text-chalk">CRM Software</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-purple/15 text-purple border-purple/30">Product</span></td><td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">78%</span></td><td className="px-4 py-3 text-center font-mono text-chalk">28</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">Partial</span></td></tr>
              <tr className="border-b border-line/50 hover:bg-surface-1"><td className="px-4 py-3 font-medium text-chalk">AI Search Visibility</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-purple/15 text-purple border-purple/30">Topic</span></td><td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">72%</span></td><td className="px-4 py-3 text-center font-mono text-chalk">18</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">Partial</span></td></tr></tbody></table></div></div></Panel></div>
  );
}