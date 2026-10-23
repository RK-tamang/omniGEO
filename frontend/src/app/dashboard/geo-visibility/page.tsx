import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Geographic Visibility" };

export default function GeoVisibilityPage() {
  return (
    <div className="space-y-6">
      <Panel title="Geographic Visibility Tracker" sub="Compare AI visibility results by market, region, or language">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Run Geo Scan</Button>
            <Button variant="secondary">Compare Regions</Button>
          </div>
          <EmptyState
            title="No regional results yet"
            sub="Geographic visibility needs a scan run per market, language and grid point. Each completed regional scan is listed here with its visibility score."
          />
        </div>
      </Panel>
    </div>
  );
}
