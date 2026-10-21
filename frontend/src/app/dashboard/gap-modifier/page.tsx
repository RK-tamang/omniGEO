"use client";

import { useState } from "react";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

interface ModifierResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

export default function GapModifierPage() {
  const [content, setContent] = useState("");
  const [instruction, setInstruction] = useState("");
  const [format, setFormat] = useState<"markdown" | "html" | "json" | "table">("markdown");
  const [result, setResult] = useState<ModifierResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [costEstimate, setCostEstimate] = useState(0);

  const handleModify = async () => {
    if (!content.trim() || !instruction.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/content/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, instruction, format }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "Failed to modify content");
      }
    } catch (e) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleEstimateCost = async () => {
    if (!content.trim() || !instruction.trim()) return;
    const estimatedInput = Math.ceil((content.length + instruction.length) / 4) + 200;
    const estimatedOutput = Math.ceil(content.length / 4);
    try {
      const res = await fetch("/api/billing/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "llm",
          operation: "claude-3-5-haiku",
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
      name: "Add Citations",
      instruction: "Add [citation needed] markers after every specific claim, statistic, or factual statement. Do not add citations to general knowledge or opinions.",
    },
    {
      name: "Create Comparison Table",
      instruction: "Extract all products/features mentioned and create a clean Markdown comparison table with columns: Feature, Product A, Product B, Winner.",
      format: "table" as const,
    },
    {
      name: "Format as FAQ",
      instruction: "Restructure this content as an FAQ section. Extract questions from headings and convert each section into a Q&A pair with concise answers.",
    },
    {
      name: "Add JSON-LD Schema",
      instruction: "Generate JSON-LD schema markup (Article, FAQPage, or HowTo as appropriate) for this content. Output only the JSON-LD script tag.",
      format: "json" as const,
    },
    {
      name: "Rewrite for Clarity",
      instruction: "Rewrite this content for maximum clarity and readability. Use shorter sentences, active voice, and clear headings. Preserve all factual claims.",
    },
    {
      name: "Extract Key Claims",
      instruction: "Extract every verifiable claim, statistic, or specific assertion as a bullet list. Format: [Claim] - [Context/Section].",
    },
  ];

  return (
    <div className="space-y-6">
      <Panel title="Gap Modifier" sub="Rewrite content & format structural tables via Claude 3.5 Haiku">
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-mist mb-2">Content to Modify</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your content here..."
                className="w-full min-h-[200px] rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
                rows={8}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-mist mb-2">Modification Instruction</label>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Describe how you want the content modified..."
                className="w-full min-h-[200px] rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
                rows={8}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-mist">Output Format:</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as "markdown" | "html" | "json" | "table")}
                className="rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-chalk focus:border-iris/60 focus:outline-none"
              >
                <option value="markdown">Markdown</option>
                <option value="table">Table</option>
                <option value="json">JSON</option>
                <option value="html">HTML</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Button onClick={handleModify} disabled={loading || !content.trim() || !instruction.trim()}>
              {loading ? "Modifying..." : "Modify Content"}
            </Button>
            <Button variant="ghost" onClick={handleEstimateCost}>
              Estimate Cost (~₹{costEstimate.toFixed(0)})
            </Button>
            {error && <span className="text-coral text-sm">{error}</span>}
          </div>

          <p className="text-xs text-mist-dim">
            Cost: $0.80/1M input • $4.00/1M output (Claude 3.5 Haiku) • Fix limits: Starter 5, Pro 20, Enterprise 50/mo
          </p>

          <div className="pt-4 border-t border-line">
            <h5 className="text-sm font-medium text-chalk mb-3">Quick Templates</h5>
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <Button
                  key={t.name}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setInstruction(t.instruction);
                    if (t.format) setFormat(t.format);
                  }}
                >
                  {t.name}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-chalk">Modified Content ({format})</h4>
              <div className="flex items-center gap-2 text-xs text-mist">
                <span>{result.usage.promptTokens} input + {result.usage.completionTokens} output = {result.usage.totalTokens} tokens</span>
                <span className="text-iris">${result.usage.estimatedCost.toFixed(4)}</span>
              </div>
            </div>
            <div
              className="prose-omni rounded-xl border border-line bg-surface-1 p-6 min-h-[200px] font-mono text-sm"
              style={{ whiteSpace: format === "json" || format === "table" ? "pre-wrap" : "normal" }}
            >
              {result.content}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(result.content)}>
                Copy {format.toUpperCase()}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setContent(result.content)}>
                Use as Input
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}