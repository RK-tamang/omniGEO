import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function CompetitorMovementPage() {
  return (
    <div className="space-y-6">
      <Panel title="Competitor Movement Tracker" sub="Monitors visibility changes over time — spot rising/falling competitors">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Run Analysis</Button>
            <Button variant="secondary">Set Alerts</Button>
          </div>
          <div className="h-64 flex items-end justify-between gap-3 px-2 pb-2">
            {[
              { label: "Competitor A", value: 45, trend: "+3%", color: "bg-mint" },
              { label: "Competitor B", value: 38, trend: "-2%", color: "bg-coral" },
              { label: "Competitor C", value: 32, trend: "+5%", color: "bg-mint" },
              { label: "Competitor D", value: 28, trend: "+1%", color: "bg-gold" },
              { label: "Competitor E", value: 22, trend: "-1%", color: "bg-gold" },
            ].map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`flex-1 w-full rounded-t transition-colors ${item.color}`}
                  style={{ height: `${item.value}%` }}
                  title={`${item.label}: ${item.value}%`}
                />
                <span className="text-xs text-mist-dim text-center w-20">{item.label}</span>
                <span className={`font-mono text-sm ${item.trend.startsWith("-") ? "text-coral" : "text-mint"}`}>{item.trend}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm text-mist mt-4">
            <span>Visibility changes over last 30 days</span>
            <span className="text-chalk font-medium">Market avg: +1.2%</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}