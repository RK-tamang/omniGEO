import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function PromptResearchPage() {
  return (
    <div className="space-y-6">
      <Panel title="Prompt Research" sub="Discover real-time conversational queries people ask AI about your niche">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mist mb-2">Seed Keywords (comma-separated)</label>
            <textarea
              placeholder="e.g., best running shoes, nike vs adidas, marathon training"
              className="w-full min-h-[100px] rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-4">
            <Button>Discover Prompts</Button>
            <Button variant="ghost">Estimate Cost (~₹120)</Button>
          </div>
          <p className="text-xs text-mist-dim">Cost: $0.01 per research run (up to 100 keywords) · Charged to workspace billing</p>
        </div>
      </Panel>
    </div>
  );
}