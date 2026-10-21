"use client";

import { useState } from "react";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

interface ContentResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

export default function ContentEnginePage() {
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are an expert GEO content strategist. Write comprehensive, citation-ready content that answers user questions directly. Use clear headings, bullet points, and include specific claims that can be verified."
  );
  const [model, setModel] = useState<"gpt-4o-mini" | "gpt-4o">("gpt-4o-mini");
  const [result, setResult] = useState<ContentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [costEstimate, setCostEstimate] = useState(0);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, systemPrompt, model, maxTokens: 4000 }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "Failed to generate content");
      }
    } catch (e) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleEstimateCost = async () => {
    if (!prompt.trim()) return;
    const estimatedInput = Math.ceil(prompt.length / 4) + 500; // system prompt ~500 tokens
    const estimatedOutput = 2000;
    try {
      const res = await fetch("/api/billing/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "llm",
          operation: model,
          quantity: estimatedInput + estimatedOutput,
          extra: { inputTokens: estimatedInput, outputTokens: estimatedOutput },
        }),
      });
      const data = await res.json();
      if (data.success) setCostEstimate(data.estimate.costNpr);
    } catch (e) {
      console.error(e);
    }
  };

  const templates = [
    {
      name: "GEO Blog Post",
      prompt: "Write a comprehensive blog post about {topic} that answers the question '{question}'. Structure with H2/H3 headings, include 5-7 specific claims with [citation needed] markers, add a FAQ section with 5 questions, and end with a summary.",
    },
    {
      name: "Content Brief",
      prompt: "Create a detailed content brief for '{topic}' targeting the keyword '{keyword}'. Include: target audience, search intent, key questions to answer, required sections, word count, internal/external link opportunities, and schema markup suggestions.",
    },
    {
      name: "Comparison Article",
      prompt: "Write a comparison article: '{product A}' vs '{product B}' for {use case}. Include feature table, pricing comparison, pros/cons, verdict, and citation-ready claims for each feature claim.",
    },
  ];

  return (
    <div className="space-y-6">
      <Panel title="Content Engine" sub="Draft GEO blogs & content briefs via OpenAI GPT-4o-mini">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-mist mb-2">Content Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to generate... or select a template below"
                className="w-full min-h-[100px] rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-2">
              {templates.map((t) => (
                <Button
                  key={t.name}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left"
                  onClick={() => setPrompt(t.prompt)}
                >
                  {t.name}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-mist mb-2">System Prompt (optional)</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full min-h-[80px] rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-mist">Model:</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as "gpt-4o-mini" | "gpt-4o")}
                className="rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-chalk focus:border-iris/60 focus:outline-none"
              >
                <option value="gpt-4o-mini">GPT-4o-mini ($0.15/$0.60 per 1M tokens)</option>
                <option value="gpt-4o">GPT-4o ($2.50/$10.00 per 1M tokens)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={handleGenerate} disabled={loading || !prompt.trim()}>
              {loading ? "Generating..." : "Generate Content"}
            </Button>
            <Button variant="ghost" onClick={handleEstimateCost}>
              Estimate Cost (~₹{costEstimate.toFixed(0)})
            </Button>
            {error && <span className="text-coral text-sm">{error}</span>}
          </div>

          <p className="text-xs text-mist-dim">
            Cost: $0.15/1M input • $0.60/1M output (GPT-4o-mini) • Prompt limits: Starter 10, Pro 30, Enterprise 50/mo
          </p>
        </div>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-chalk">Generated Content</h4>
              <div className="flex items-center gap-2 text-xs text-mist">
                <span>{result.usage.promptTokens} input + {result.usage.completionTokens} output = {result.usage.totalTokens} tokens</span>
                <span className="text-iris">${result.usage.estimatedCost.toFixed(4)}</span>
              </div>
            </div>
            <div className="prose-omni rounded-xl border border-line bg-surface-1 p-6 min-h-[300px]">
              {result.content}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(result.content)}>
                Copy Markdown
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(result.content)}>
                Copy as HTML
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}