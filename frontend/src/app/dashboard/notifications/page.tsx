import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <Panel title="Email & Integration Notifications" sub="Slack, email, webhook integrations for real-time alert delivery">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Add Integration</Button>
            <Button variant="secondary">Test All</Button>
          </div>
          <div className="space-y-3">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-iris/15 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" stroke="#8b5cf6" strokeWidth="1.6" strokeLinecap="round"/><path d="M22 6l-10 10L4 10" stroke="#8b5cf6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div><span className="font-medium text-chalk">Email</span><p className="text-xs text-mist-dim">Connected • team@northwind.io</p></div>
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Active</span>
              </div>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gold/15 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#fbbf24" strokeWidth="1.6" strokeLinecap="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#fbbf24" strokeWidth="1.6" strokeLinecap="round"/></svg>
                </div>
                <div><span className="font-medium text-chalk">Slack</span><p className="text-xs text-mist-dim">Connected • #geo-alerts</p></div>
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Active</span>
              </div>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-coral/15 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="#fb7185" strokeWidth="1.6" strokeLinecap="round"/><polyline points="15 7 10 12 5 7" stroke="#fb7185" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div><span className="font-medium text-chalk">Webhook</span><p className="text-xs text-mist-dim">Connected • https://api.northwind.io/webhooks</p></div>
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Active</span>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}