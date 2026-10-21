"use client";

import { useState } from "react";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

interface CrawlResult {
  url: string;
  title: string;
  description: string;
  markdown: string;
  links: Array<{ url: string; text: string }>;
}

export default function SiteCrawlerPage() {
  const [urls, setUrls] = useState("");
  const [provider, setProvider] = useState<"firecrawl" | "jina">("firecrawl");
  const [results, setResults] = useState<CrawlResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [costEstimate, setCostEstimate] = useState(0);

  const handleCrawl = async () => {
    const urlArray = urls.split("\n").map((u) => u.trim()).filter(Boolean);
    if (urlArray.length === 0) return;
    setLoading(true);
    setError("");

    try {
      if (urlArray.length === 1) {
        const res = await fetch("/api/crawler/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urlArray[0], provider }),
        });
        const data = await res.json();
        if (data.success && data.data) {
          setResults([data.data]);
        } else {
          setError(data.error || "Failed to crawl");
        }
      } else {
        const res = await fetch("/api/crawler/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: urlArray, provider }),
        });
        const data = await res.json();
        if (data.success) {
          setError(`Bulk crawl started (Job ID: ${data.jobId}). Results will appear via webhook.`);
        } else {
          setError(data.error || "Failed to start bulk crawl");
        }
      }
    } catch (e) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleEstimateCost = async () => {
    const urlArray = urls.split("\n").map((u) => u.trim()).filter(Boolean);
    if (urlArray.length === 0) return;

    try {
      const res = await fetch("/api/billing/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: "crawler", operation: provider, quantity: urlArray.length }),
      });
      const data = await res.json();
      if (data.success) setCostEstimate(data.estimate.costNpr);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <Panel title="Site Crawler" sub="Parse HTML, JS & competitor URLs via Firecrawl or Jina AI">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mist mb-2">URLs (one per line)</label>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://example.com\nhttps://competitor.com/page"
              className="w-full min-h-[120px] rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
              rows={4}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-mist">Provider:</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as "firecrawl" | "jina")}
                className="rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-chalk focus:border-iris/60 focus:outline-none"
              >
                <option value="firecrawl">Firecrawl (full JS rendering)</option>
                <option value="jina">Jina AI (fast, lightweight)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={handleCrawl} disabled={loading || !urls.trim()}>
              {loading ? "Crawling..." : urls.split("\n").filter(Boolean).length === 1 ? "Crawl URL" : "Start Bulk Crawl"}
            </Button>
            <Button variant="ghost" onClick={handleEstimateCost}>
              Estimate Cost (~₹{costEstimate.toFixed(0)})
            </Button>
            {error && <span className="text-coral text-sm">{error}</span>}
          </div>

          <p className="text-xs text-mist-dim">
            Cost: $0.001 per crawled page • 2% transaction fee on NPR billing
          </p>
        </div>

        {results.length > 0 && (
          <div className="mt-6 space-y-4">
            <h4 className="font-medium text-chalk">Crawled Results ({results.length})</h4>
            {results.map((result, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface-1 p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h5 className="font-medium text-chalk">{result.title || "Untitled"}</h5>
                    <p className="text-sm text-mist truncate max-w-2xl">{result.url}</p>
                  </div>
                </div>
                <div className="prose-omni max-h-96 overflow-y-auto">
                  {result.markdown.slice(0, 3000)}
                </div>
                {result.links.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-sm text-iris cursor-pointer">Found {result.links.length} links</summary>
                    <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {result.links.slice(0, 20).map((link, idx) => (
                        <li key={idx} className="text-xs text-mist truncate">
                          <a href={link.url} target="_blank" rel="noopener" className="hover:text-iris">
                            {link.text || link.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}