import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function EntityCoveragePage() {
  return (
    <div className="space-y-6">
      <Panel title="Entity & Topic Coverage Checker" sub="Verifies your content covers all key entities, topics, and semantic relationships">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Check Coverage</Button>
            <Button variant="secondary">View Details</Button>
          </div>
          <EmptyState
            title="No coverage check yet"
            sub="Coverage is measured against the entities the crawler finds on your pages. Run a check and every entity is listed with its coverage and status."
          />
        </div>
      </Panel>
    </div>
  );
}
