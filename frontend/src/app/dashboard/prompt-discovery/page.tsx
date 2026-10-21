"use client";

import { useState } from "react";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";

interface KeywordIdea {
  keyword: string;
  search_volume: number;
  competition: number;
  cpc: number;
}

export default function PromptDiscoveryPage() {
  const [keywords, setKeywords] = useState("");
  const [results, setResults] = useState<KeywordIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [costEstimate, setCostEstimate] = useState(0);

  const handleSearch = async () => {
    if (!keywords.trim()) return;
    setLoading(true);
    setError("");

    try {
      const kwArray = keywords.split(",").map((k) => k.trim()).filter(Boolean);
      const res = await fetch("/api/dataforseo/keyword-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: kwArray }),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.error || "Failed to fetch keyword ideas");
      }
    } catch (e) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleEstimateCost = async () => {
    const kwArray = keywords.split(",").map((k) => k.trim()).filter(Boolean);
    if (kwArray.length === 0) return;

    try {
      const res = await fetch("/api/billing/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: "dataforseo", operation: "keyword_ideas", quantity: 1 }),
      });
      const data = await res.json();
      if (data.success) setCostEstimate(data.estimate.costNpr);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <Panel title="Prompt Discovery" sub="Extract real-time conversational queries from DataForSEO Keyword Ideas API">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mist mb-2">Seed Keywords (comma-separated)</label>
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g., best running shoes, nike vs adidas, marathon training"
              className="w-full min-h-[100px] rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={handleSearch} disabled={loading || !keywords.trim()}>
              {loading ? "Discovering..." : "Discover Prompts"}
            </Button>
            <Button variant="ghost" onClick={handleEstimateCost}>
              Estimate Cost (~₹{costEstimate.toFixed(0)})
            </Button>
            {error && <span className="text-coral text-sm">{error}</span>}
          </div>

          <p className="text-xs text-mist-dim">
            Cost: $0.01 per research run (up to 100 keywords) • Charged to your workspace billing
          </p>
        </div>

        {results.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-chalk mb-3">Discovered Prompts ({results.length})</h4>
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Prompt</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-mist">Search Volume</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-mist">Competition</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-mist">CPC (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((kw, i) => (
                    <tr key={i} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-mono text-sm text-chalk">{kw.keyword}</td>
                      <td className="px-4 py-3 text-right text-sm text-mist">{kw.search_volume.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-sm text-mist">{kw.competition}</td>
                      <td className="px-4 py-3 text-right text-sm text-mist">${kw.cpc.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}