import { Panel } from "@/components/dashboard/panel";
import { MarketShareChart } from "@/components/dashboard/market-share-chart";

export default function MarketSharePage() {
  return (
    <div className="space-y-6">
      <Panel title="Market Share Dashboard" sub="Compares AI mentions and recommendations across tracked brands in your niche">
        <MarketShareChart />
      </Panel>
    </div>
  );
}
