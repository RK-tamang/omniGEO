import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function SourceRecommenderPage() {
  return (
    <div className="space-y-6">
      <Panel title="Statistics & Source Recommender" sub="Finds credible statistics, studies, and sources to back your claims — auto-links">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mist mb-2">Your Claim / Topic</label>
            <textarea placeholder="e.g., CRM software increases sales productivity by 30%" className="w-full min-h-[80px] rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors" rows={2} />
          </div>
          <div className="flex items-center gap-4">
            <Button>Find Sources</Button>
            <Button variant="secondary">Verify Claims</Button>
          </div>
          <p className="text-xs text-mist-dim">Finds credible statistics, studies, and authoritative sources — auto-generates citations</p>
          <EmptyState
            title="No sources recommended yet"
            sub="Give the recommender a claim and it searches for studies and reports that back it. Every source it returns is listed here with its URL."
          />
        </div>
      </Panel>
    </div>
  );
}
