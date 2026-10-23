"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { mergeContentItems, mergePrompts } from "@/lib/workspace-data";

export default function BriefGeneratorPage() {
  const { data } = useWorkspaceData();
  const items = mergeContentItems(data);
  const prompts = mergePrompts(data);

  return (
    <div className="space-y-6">
      <Panel title="Content Brief Generator" sub="Creates detailed GEO content briefs — target prompts, structure, sources, schema needs">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mist mb-2">Topic / Target Prompt</label>
            <input type="text" placeholder="e.g., Best CRM for Small Business" className="w-full rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-mist mb-2">Target Engines</label>
              <div className="flex flex-wrap gap-2">
                {["ChatGPT", "Perplexity", "Gemini", "AI Overviews"].map((e) => (
                  <label key={e} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-1 px-3 py-1.5 text-sm text-mist hover:bg-iris/10 hover:border-iris/30 cursor-pointer transition-colors">
                    <input type="checkbox" className="w-4 h-4 accent-iris" defaultChecked />
                    <span>{e}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-mist mb-2">Target Word Count</label>
              <input type="number" defaultValue={2000} className="w-full rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button>Generate Brief</Button>
            <Button variant="secondary">Save as Template</Button>
          </div>
          <p className="text-xs text-mist-dim">Includes: target prompts, structure outline, key questions, source recommendations, schema types, word count</p>

          {items.length === 0 ? (
            <EmptyState
              title="No briefs yet"
              sub="Generated briefs are saved as content pieces. They are listed here with their target prompt, length and status."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Brief Title</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Target Prompt</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Word Count</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.title} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk">{item.title}</td>
                      <td className="px-4 py-3 text-center text-sm text-chalk">{item.target || "—"}</td>
                      <td className="px-4 py-3 text-center font-mono text-chalk">{item.words.toLocaleString("en-GB")}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-mist">{item.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {prompts.length === 0 ? (
            <p className="text-xs text-mist-dim">
              No prompts tracked yet — a brief picks its target prompt from the ones you track.
            </p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
