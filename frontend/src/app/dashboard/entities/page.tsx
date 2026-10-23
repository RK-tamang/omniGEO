import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function EntitiesPage() {
  return (
    <div className="space-y-6">
      <Panel title="Entity Optimization Analyzer" sub="Reviews brand, product, and organization entity consistency across pages">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Entities</Button>
            <Button variant="secondary">Export Report</Button>
          </div>
          <EmptyState
            title="No entity analysis yet"
            sub="Entity consistency is measured by crawling your pages and comparing how each brand, product and person is described. Run an entity analysis and the results are listed here."
          />
        </div>
      </Panel>
    </div>
  );
}
