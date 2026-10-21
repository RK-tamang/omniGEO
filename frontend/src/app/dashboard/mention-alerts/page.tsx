import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function MentionAlertsPage() {
  return (
    <div className="space-y-6">
      <Panel title="Brand Mention Alerts" sub="Real-time alerts when your brand is mentioned (or stops being mentioned) in AI answers">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Create Alert</Button>
            <Button variant="secondary">Manage Rules</Button>
          </div>
          <div className="space-y-3">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border-l-4 border-iris flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Active</span>
                <span className="font-medium text-chalk">New mention: &ldquo;Northwind Labs&rdquo; in ChatGPT</span>
              </div>
              <span className="text-xs text-mist-dim">2 min ago</span>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border-l-4 border-gold flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">Active</span>
                <span className="font-medium text-chalk">Mention lost: &ldquo;Northwind Labs&rdquo; dropped from Perplexity answer</span>
              </div>
              <span className="text-xs text-mist-dim">15 min ago</span>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border-l-4 border-coral flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-coral/15 text-coral border-coral/30">Critical</span>
                <span className="font-medium text-chalk">Sentiment shift: Negative mentions up 40% for &ldquo;CRM pricing&rdquo;</span>
              </div>
              <span className="text-xs text-mist-dim">1 hour ago</span>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}