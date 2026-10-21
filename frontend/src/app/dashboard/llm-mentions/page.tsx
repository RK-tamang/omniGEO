// eslint-disable-next-line @typescript-eslint/no-explicit-any
"use client";

import { useState } from "react";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

interface LLMResult {
  answer: string;
  citations: Array<{ domain: string; url: string; title: string }>;
  model: string;
}

export default function LLMMentionsPage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<"chatgpt" | "perplexity" | "gemini" | "aio">("chatgpt");
  const [result, setResult] = useState<LLMResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [costEstimate, setCostEstimate] = useState(0);

  const handleQuery = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/dataforseo/llm-mentions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setResult(data.data as LLMResult);
      } else {
        setError(data.error || "Failed to fetch LLM mentions");
      }
    } catch (e) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleEstimateCost = async () => {
    if (!prompt.trim()) return;
    try {
      const res = await fetch("/api/billing/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: "dataforseo", operation: "llm_api", quantity: 1 }),
      });
      const data = await res.json();
      if (data.success) setCostEstimate(data.estimate.costNpr);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <Panel title="LLM Mentions" sub="Fetch live answers & citations from LLMs via DataForSEO LLM API">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mist mb-2">Prompt / Question</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Who is the best CRM for small business? Compare HubSpot vs Salesforce."
              className="w-full min-h-[100px] rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-mist">Model:</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as "chatgpt" | "perplexity" | "gemini" | "aio")}
                className="rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-chalk focus:border-iris/60 focus:outline-none"
              >
                <option value="chatgpt">ChatGPT</option>
                <option value="perplexity">Perplexity</option>
                <option value="gemini">Gemini</option>
                <option value="aio">Google AI Overviews</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={handleQuery} disabled={loading || !prompt.trim()}>
              {loading ? "Querying..." : "Query LLM"}
            </Button>
            <Button variant="ghost" onClick={handleEstimateCost}>
              Estimate Cost (~₹{costEstimate.toFixed(0)})
            </Button>
            {error && <span className="text-coral text-sm">{error}</span>}
          </div>

          <p className="text-xs text-mist-dim">
            Cost: $0.101 per live query call • Charged to your workspace billing
          </p>
        </div>

        {result && (
          <div className="mt-6 space-y-4">
            <h4 className="font-medium text-chalk">LLM Answer ({result.model})</h4>
            <div className="prose-omni rounded-xl border border-line bg-surface-1 p-6">
              {result.answer}
            </div>

            {result.citations.length > 0 && (
              <div>
                <h4 className="font-medium text-chalk mb-3">Citations ({result.citations.length})</h4>
                <div className="rounded-xl border border-line overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-1 border-b border-line">
                        <th className="px-4 py-3 text-left text-sm font-medium text-mist">#</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-mist">Domain</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-mist">Title</th>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                         <th className="px-4 py-3 text-left text-sm font-medium text-mist">URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.citations.map((cite, i) => (
                        <tr key={i} className="border-b border-line/50 hover:bg-surface-1">
                          <td className="px-4 py-3 font-mono text-sm text-chalk">{i + 1}</td>
                          <td className="px-4 py-3 text-sm text-chalk">{cite.domain}</td>
                          <td className="px-4 py-3 text-sm text-mist">{cite.title}</td>
                          <td className="px-4 py-3 text-sm text-mist">
                            <a href={cite.url} target="_blank" rel="noopener" className="hover:text-iris truncate max-w-xs block">
                              {cite.url}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}