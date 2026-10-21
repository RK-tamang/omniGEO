"use client";

import { useState } from "react";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

interface RankResult {
  rank_group: number;
  rank_absolute: number;
  position: string;
  title: string;
  domain: string;
  url: string;
  latitude: number;
  longitude: number;
}

export default function RankTrackerPage() {
  const [keyword, setKeyword] = useState("");
  const [gridSize, setGridSize] = useState<"5x5" | "7x7">("5x5");
  const [location, setLocation] = useState("2840"); // Default: India
  const [results, setResults] = useState<RankResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [costEstimate, setCostEstimate] = useState(0);

  const handleTrack = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/dataforseo/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, location_code: parseInt(location), grid_size: gridSize }),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.error || "Failed to fetch rankings");
      }
    } catch (e) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleEstimateCost = async () => {
    if (!keyword.trim()) return;
    const serpRequests = gridSize === "7x7" ? 49 : 25;
    try {
      const res = await fetch("/api/billing/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: "dataforseo", operation: "maps_api", quantity: serpRequests }),
      });
      const data = await res.json();
      if (data.success) setCostEstimate(data.estimate.costNpr);
    } catch (e) {
      console.error(e);
    }
  };

  const SERP_REQUESTS = gridSize === "7x7" ? 49 : 25;

  return (
    <div className="space-y-6">
      <Panel title="Rank Tracker (Geo-Grid)" sub="Scan 5×5 or 7×7 local Geo-Grid SERP points via DataForSEO Maps API">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mist mb-2">Target Keyword</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g., best coffee shop near me, plumber in mumbai"
              className="w-full rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-mist mb-2">Grid Size</label>
              <select
                value={gridSize}
                onChange={(e) => setGridSize(e.target.value as "5x5" | "7x7")}
                className="w-full rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk focus:border-iris/60 focus:outline-none transition-colors"
              >
                <option value="5x5">5×5 (25 SERP requests)</option>
                <option value="7x7">7×7 (49 SERP requests)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-mist mb-2">Location Code</label>
              <input
                type="number"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
                placeholder="2840 (India), 2840 (US), etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-mist mb-2">Estimated SERP Requests</label>
              <div className="w-full rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk font-mono text-lg">
                {SERP_REQUESTS}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={handleTrack} disabled={loading || !keyword.trim()}>
              {loading ? "Tracking..." : "Track Rankings"}
            </Button>
            <Button variant="ghost" onClick={handleEstimateCost}>
              Estimate Cost (~₹{costEstimate.toFixed(0)})
            </Button>
            {error && <span className="text-coral text-sm">{error}</span>}
          </div>

          <p className="text-xs text-mist-dim">
            Cost: $0.0006 per SERP request • {SERP_REQUESTS} requests = ${(SERP_REQUESTS * 0.0006).toFixed(4)} per run
          </p>
        </div>

        {results.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-chalk mb-3">Geo-Grid Rankings ({results.length} positions)</h4>
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Rank</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Title</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Domain</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Coordinates</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">URL</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 50).map((item, i) => (
                    <tr key={i} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-mono text-sm text-chalk">#{item.rank_absolute}</td>
                      <td className="px-4 py-3 text-sm text-chalk truncate max-w-xs">{item.title}</td>
                      <td className="px-4 py-3 text-sm text-mist">{item.domain}</td>
                      <td className="px-4 py-3 text-sm text-mist font-mono">
                        {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">
                        <a href={item.url} target="_blank" rel="noopener" className="hover:text-iris">{item.url}</a>
                      </td>
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