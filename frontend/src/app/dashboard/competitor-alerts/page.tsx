import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function CompetitorAlertsPage() {
  return (
    <div className="space-y-6">
      <Panel title="New Competitor Alerts" sub="Notified when new competitors appear in tracked answer spaces">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Configure Alerts</Button>
            <Button variant="secondary">View History</Button>
          </div>
          <div className="space-y-3">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border-l-4 border-aqua flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-aqua/15 text-aqua border-aqua/30">New</span>
                <span className="font-medium text-chalk">New competitor detected: &ldquo;Salesforce CRM&rdquo; for &ldquo;enterprise CRM software&rdquo;</span>
              </div>
              <span className="text-xs text-mist-dim">5 min ago</span>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border-l-4 border-gold flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">New</span>
                <span className="font-medium text-chalk">New competitor: &ldquo;Zoho CRM&rdquo; now appearing for &ldquo;best CRM for small business&rdquo;</span>
              </div>
              <span className="text-xs text-mist-dim">2 hours ago</span>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border-l-4 border-mist flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mist/15 text-mist border-mist/30">Resolved</span>
                <span className="font-medium text-chalk">&ldquo;Freshworks CRM&rdquo; no longer appearing for tracked prompts</span>
              </div>
              <span className="text-xs text-mist-dim">1 day ago</span>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}