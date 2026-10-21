import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function CitationAlertsPage() {
  return (
    <div className="space-y-6">
      <Panel title="Citation Loss Alerts" sub="Immediate notification when you lose a citation to a competitor">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Configure Alerts</Button>
            <Button variant="secondary">View History</Button>
          </div>
          <div className="space-y-3">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border-l-4 border-coral flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-coral/15 text-coral border-coral/30">Critical</span>
                <span className="font-medium text-chalk">Citation lost: &ldquo;Best CRM 2024&rdquo; - HubSpot replaced Northwind Labs in ChatGPT</span>
              </div>
              <span className="text-xs text-mist-dim">3 min ago</span>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border-l-4 border-gold flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">Warning</span>
                <span className="font-medium text-chalk">Citation lost: &ldquo;AI search visibility&rdquo; - Competitor B now cited in Perplexity</span>
              </div>
              <span className="text-xs text-mist-dim">15 min ago</span>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border-l-4 border-coral flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-coral/15 text-coral border-coral/30">Critical</span>
                <span className="font-medium text-chalk">Citation lost: &ldquo;CRM pricing&rdquo; - Competitor C now cited in AI Overviews</span>
              </div>
              <span className="text-xs text-mist-dim">1 hour ago</span>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}