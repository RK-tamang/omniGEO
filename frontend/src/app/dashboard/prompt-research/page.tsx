"use client";

import { useEffect, useState } from "react";
import { DashboardHeader, Panel, StatusChip } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import api from "@/lib/api-client";

export default function PromptResearchPage() {
  const [loading, setLoading] = useState(true);
  const [prompts, setPrompts] = useState<any[]>([]);

  useEffect(() => {
    api.getPrompts().then((res) => {
      if (res.ok) setPrompts(res.data?.prompts ?? res.data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Prompt Research"
        sub="Explore, generate, and track AI search prompts across engines and markets"
        aside={<Button size="sm">Generate Prompts</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="Saved Prompts" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">{prompts.length}</p>
            <p className="mt-2 text-xs text-mist-dim">Prompts being tracked</p>
          </div>
        </Panel>
        <Panel title="Prompt Groups" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">0</p>
            <p className="mt-2 text-xs text-mist-dim">Organized prompt groups</p>
          </div>
        </Panel>
        <Panel title="Ideas Generated" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">0</p>
            <p className="mt-2 text-xs text-mist-dim">Deterministic prompt ideas</p>
          </div>
        </Panel>
      </div>

      <Panel title="Prompt Explorer" level={2}>
        {prompts.length === 0 ? (
          <EmptyState title="No prompts" sub="Create or generate prompts to start tracking AI visibility per prompt." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                  <th className="pb-3 pr-4 font-normal">Prompt</th>
                  <th className="pb-3 pr-4 font-normal">Engine</th>
                  <th className="pb-3 pr-4 font-normal">Status</th>
                  <th className="pb-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {prompts.map((p, i) => (
                  <tr key={i} className="border-b border-line/70">
                    <td className="py-3 pr-4 truncate font-mono text-[0.68rem] text-chalk">{p.exact_prompt || p.text || "Untitled"}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-mist-dim">{p.engine ?? "—"}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-mist-dim">{p.country ?? "US"}</td>
                    <td className="py-3"><StatusChip status="published" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Prompt Idea Generator" level={2}>
        <div className="space-y-4">
          <label className="block text-xs font-mono text-mist-dim uppercase tracking-widest">Brand or topic</label>
          <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-iris" placeholder="e.g. CRM software" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Generate Ideas</Button>
            <Button size="sm">Save Selected</Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}