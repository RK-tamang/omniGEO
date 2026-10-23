"use client";

import { useState } from "react";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { mergeContentItems } from "@/lib/workspace-data";

export default function AnswerFaqPage() {
  const { data } = useWorkspaceData();
  const items = mergeContentItems(data);

  const [topic, setTopic] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (topic.trim().length < 10) {
      setError("Give the generator at least a sentence of context.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Write direct answers and FAQ entries for the following topic:\n\n${topic.trim()}`,
          systemPrompt:
            "You write answer-engine-ready copy. Lead every question with a 40-60 word direct answer, then elaborate.",
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) throw new Error(body?.error ?? "Generation failed.");
      setOutput(body.content ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel title="AI Answer & FAQ Generator" sub="Generates direct answers and FAQ sections from your content — ready for AI Overviews">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mist mb-2">Your Content / Topic</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Paste your content or describe the topic..."
              className="w-full min-h-[100px] rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={generate} disabled={busy}>
              {busy ? "Generating…" : "Generate Answers & FAQs"}
            </Button>
          </div>
          <p className="text-xs text-mist-dim">Generates direct answers, FAQ sections, and FAQPage schema markup</p>
          {error ? <p className="text-sm text-coral">{error}</p> : null}

          {output ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface-1 p-4 text-sm leading-relaxed text-mist">
              {output}
            </pre>
          ) : null}

          {items.length === 0 ? (
            <EmptyState
              title="Nothing generated yet"
              sub="Generated answers are saved to this workspace and listed here with their status."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Generated Item</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Target prompt</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.title} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk">{item.title}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-mist">{item.target || "—"}</td>
                      <td className="px-4 py-3 text-center text-sm text-mist">{item.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
