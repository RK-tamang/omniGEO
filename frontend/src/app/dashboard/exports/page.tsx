import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function ExportsPage() {
  return (
    <div className="space-y-6">
      <Panel title="PDF & CSV Exports" sub="One-click export of all data — visibility, citations, competitors, prompts">
        <div className="space-y-4">
          <div className="flex items-center gap-4"><Button>Export All Data</Button><Button variant="secondary">Custom Export</Button></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover"><div className="text-iris text-2xl mb-3">📊</div><h3 className="font-medium text-chalk mb-2">Visibility Data</h3><p className="text-sm text-mist mb-4">Scores, trends, citations, competitor share</p><Button className="w-full" size="sm">Export CSV</Button></div><div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover"><div className="text-gold text-2xl mb-3">🏆</div><h3 className="font-medium text-chalk mb-2">Competitor Data</h3><p className="text-sm text-mist mb-4">Visibility, citations, prompt gaps, movement</p><Button className="w-full" size="sm" variant="secondary">Export CSV</Button></div><div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover"><div className="text-mint text-2xl mb-3">📝</div><h3 className="font-medium text-chalk mb-2">Content & Prompts</h3><p className="text-sm text-mist mb-4">Briefs, scores, optimization history</p><Button className="w-full" size="sm" variant="secondary">Export CSV</Button></div><div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover"><div className="text-coral text-2xl mb-3">📋</div><h3 className="font-medium text-chalk mb-2">Audit Issues</h3><p className="text-sm text-mist mb-4">Issues, fixes, priorities, assignments</p><Button className="w-full" size="sm" variant="secondary">Export CSV</Button></div></div>
        </div>
      </Panel>
    </div>
  );
}