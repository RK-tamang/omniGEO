import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function ShareOfVoicePage() {
  return (
    <div className="space-y-6">
      <Panel title="AI Share of Voice" sub="Compare your brand mentions with competitors across tracked prompts">
        <div className="space-y-4">
          <div className="h-64 flex items-end justify-between gap-3 px-2 pb-2">
            {[
              { label: "You", value: 68, color: "bg-iris" },
              { label: "Competitor A", value: 45, color: "bg-aqua" },
              { label: "Competitor B", value: 38, color: "bg-gold" },
              { label: "Competitor C", value: 32, color: "bg-coral" },
              { label: "Competitor D", value: 28, color: "bg-mint" },
              { label: "Competitor E", value: 22, color: "bg-mist" },
            ].map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`flex-1 w-full rounded-t transition-colors ${item.color}`}
                  style={{ height: `${item.value}%` }}
                  title={`${item.label}: ${item.value}%`}
                />
                <span className="text-xs text-mist-dim text-center w-20">{item.label}</span>
                <span className="font-mono text-sm text-chalk">{item.value}%</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm text-mist mt-4">
            <span>Market share across 150 tracked prompts</span>
            <span className="text-chalk font-medium">Your share: 68%</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}