import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function AnswerFaqPage() {
  return (
    <div className="space-y-6">
      <Panel title="AI Answer & FAQ Generator" sub="Generates direct answers and FAQ sections from your content — ready for AI Overviews">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mist mb-2">Your Content / Topic</label>
            <textarea
              placeholder="Paste your content or describe the topic..."
              className="w-full min-h-[100px] rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-4">
            <Button>Generate Answers & FAQs</Button>
            <Button variant="secondary">Generate Schema</Button>
          </div>
          <p className="text-xs text-mist-dim">Generates direct answers, FAQ sections, and FAQPage schema markup</p>

          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Generated Item</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Type</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">What is the best CRM for small business?</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-iris/15 text-iris border-iris/30">Direct Answer</span></td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Ready</span></td>
                  <td className="px-4 py-3 text-center"><Button size="sm">Copy</Button></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">FAQ: CRM pricing for small teams</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">FAQ Section</span></td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Ready</span></td>
                  <td className="px-4 py-3 text-center"><Button size="sm">Copy</Button></td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk">FAQPage Schema (JSON-LD)</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-purple/15 text-purple border-purple/30">Schema</span></td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">Ready</span></td>
                  <td className="px-4 py-3 text-center"><Button size="sm">Copy JSON</Button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}