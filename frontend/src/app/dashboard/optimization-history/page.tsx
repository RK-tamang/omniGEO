import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function OptimizationHistoryPage() {
  return (
    <div className="space-y-6">
      <Panel title="Content Optimization History" sub="Version control for GEO edits — tracks changes, visibility impact, and rollback points">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>View Full History</Button>
            <Button variant="secondary">Export Log</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full"><thead><tr className="bg-surface-1 border-b border-line"><th className="px-4 py-3 text-left text-sm font-medium text-mist">Page</th><th className="px-4 py-3 text-center text-sm font-medium text-mist">Version</th><th className="px-4 py-3 text-left text-sm font-medium text-mist">Change</th><th className="px-4 py-3 text-center text-sm font-medium text-mist">Impact</th><th className="px-4 py-3 text-left text-sm font-medium text-mist">Author</th><th className="px-4 py-3 text-left text-sm font-medium text-mist">Date</th></tr></thead><tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1"><td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">Best CRM for Small Business 2024</td><td className="px-4 py-3 text-center font-mono text-chalk">v3.2</td><td className="px-4 py-3 text-sm text-mist">Added 5 new citations, updated pricing table</td><td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">+12 citations</span></td><td className="px-4 py-3 text-sm text-mist">Aarav Mehta</td><td className="px-4 py-3 text-sm text-mist">2 days ago</td></tr>
                <tr className="border-b border-line/50 hover:bg-surface-1"><td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">AI Search Visibility Guide</td><td className="px-4 py-3 text-center font-mono text-chalk">v2.1</td><td className="px-4 py-3 text-sm text-mist">Added FAQ schema, updated citations</td><td className="px-4 py-3 text-center"><span className="text-mint font-mono text-sm">+5 citations</span></td><td className="px-4 py-3 text-sm text-mist">Priya Sharma</td><td className="px-4 py-3 text-sm text-mist">1 week ago</td></tr>
                <tr className="border-b border-line/50 hover:bg-surface-1"><td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">Schema Markup for Local SEO</td><td className="px-4 py-3 text-center font-mono text-chalk">v1.3</td><td className="px-4 py-3 text-sm text-mist">Fixed schema validation errors</td><td className="px-4 py-3 text-center"><span className="text-coral font-mono text-sm">-2 errors</span></td><td className="px-4 py-3 text-sm text-mist">Raj Patel</td><td className="px-4 py-3 text-sm text-mist">3 days ago</td></tr></tbody></table></div></div></Panel></div>
  );
}