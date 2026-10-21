import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function ScheduledChecksPage() {
  return (
    <div className="space-y-6">
      <Panel title="Scheduled Visibility Checks" sub="Daily or scheduled AI visibility checks across all tracked prompts and engines">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Run Check Now</Button>
            <Button variant="secondary">Configure Schedule</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5"><p className="text-sm text-mist">Active Checks</p><p className="mt-2 text-3xl font-semibold text-chalk">12</p></div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5"><p className="text-sm text-mist">Last Run</p><p className="mt-2 text-3xl font-semibold text-chalk">2 hours ago</p></div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5"><p className="text-sm text-mist">Success Rate</p><p className="mt-2 text-3xl font-semibold text-mint">98.5%</p></div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5"><p className="text-sm text-mist">Next Scheduled</p><p className="mt-2 text-3xl font-semibold text-chalk">Today 6:00 AM</p></div>
          </div>
          <div className="rounded-xl border border-line overflow-hidden"><table className="w-full"><thead><tr className="bg-surface-1 border-b border-line"><th className="px-4 py-3 text-left text-sm font-medium text-mist">Check</th><th className="px-4 py-3 text-center text-sm font-medium text-mist">Schedule</th><th className="px-4 py-3 text-center text-sm font-medium text-mist">Engines</th><th className="px-4 py-3 text-center text-sm font-medium text-mist">Prompts</th><th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th></tr></thead><tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1"><td className="px-4 py-3 font-medium text-chalk">Daily Visibility Scan</td><td className="px-4 py-3 text-center text-sm text-mist">Daily 6:00 AM</td><td className="px-4 py-3 text-center text-sm text-mist">4</td><td className="px-4 py-3 text-center font-mono text-chalk">150</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Active</span></td></tr>
                <tr className="border-b border-line/50 hover:bg-surface-1"><td className="px-4 py-3 font-medium text-chalk">Weekly Deep Audit</td><td className="px-4 py-3 text-center text-sm text-mist">Monday 9:00 AM</td><td className="px-4 py-3 text-center text-sm text-mist">4</td><td className="px-4 py-3 text-center font-mono text-chalk">50</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Active</span></td></tr>
                <tr className="border-b border-line/50 hover:bg-surface-1"><td className="px-4 py-3 font-medium text-chalk">Competitor Tracking</td><td className="px-4 py-3 text-center text-sm text-mist">Daily 3:00 AM</td><td className="px-4 py-3 text-center text-sm text-mist">4</td><td className="px-4 py-3 text-center font-mono text-chalk">8</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Active</span></td></tr>
                <tr className="border-b border-line/50 hover:bg-surface-1"><td className="px-4 py-3 font-medium text-chalk">Citation Health Check</td><td className="px-4 py-3 text-center text-sm text-mist">Weekly Friday 3 PM</td><td className="px-4 py-3 text-center text-sm text-mist">4</td><td className="px-4 py-3 text-center font-mono text-chalk">200</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mist/15 text-mist border-mist/30">Paused</span></td></tr></tbody></table></div></div></Panel></div>
  );
}