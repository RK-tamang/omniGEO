import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function TopicalAuthorityPage() {
  return (
    <div className="space-y-6">
      <Panel title="Topical Authority Analyzer" sub="Identifies topic coverage depth, content gaps, and semantic completeness">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Authority</Button>
            <Button variant="secondary">View Gaps</Button>
          </div>
          <EmptyState
            title="No topic clusters yet"
            sub="Clusters are built from the pages the crawler reads and the prompts you track. Once an analysis runs, each cluster is listed with its coverage and gap score."
          />
        </div>
      </Panel>
    </div>
  );
}
