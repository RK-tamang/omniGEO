import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function BriefGeneratorPage() {
  return (
    <div className="space-y-6">
      <Panel title="Content Brief Generator" sub="Creates detailed GEO content briefs — target prompts, structure, sources, schema needs">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mist mb-2">Topic / Target Prompt</label>
            <input type="text" placeholder="e.g., Best CRM for Small Business 2024" className="w-full rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors" />
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
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Brief Title</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Target Prompts</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Word Count</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Created</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">Best CRM for Small Business 2024</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">5 prompts</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">2,000</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Ready</span></td>
                  <td className="px-4 py-3 text-sm text-mist">2 days ago</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">AI Search Visibility Guide</td>
                  <td className="px-4 py-3 text-center text-sm text-chalk">4 prompts</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">1,800</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-aqua/15 text-aqua border-aqua/30">In Progress</span></td>
                  <td className="px-4 py-3 text-sm text-mist">1 week ago</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}