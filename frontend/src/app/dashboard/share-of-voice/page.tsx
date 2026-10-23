import { Panel } from "@/components/dashboard/panel";
import { MarketShareChart } from "@/components/dashboard/market-share-chart";

export default function ShareOfVoicePage() {
  return (
    <div className="space-y-6">
      <Panel title="AI Share of Voice" sub="Compare your brand mentions with competitors across tracked prompts">
        <MarketShareChart />
      </Panel>
    </div>
  );
}
