import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function LandingComparePage() {
  return (
    <div className="space-y-6">
      <Panel title="Landing Page Comparison" sub="A/B tests GEO-optimized vs. original — measures citation lift and visibility delta">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Create Test</Button>
            <Button variant="secondary">View Results</Button>
          </div>
          <EmptyState
            title="No landing page tests yet"
            sub="A test runs both variants against the same prompts and reports the citation lift. Every completed test is listed here with its result."
          />
        </div>
      </Panel>
    </div>
  );
}
