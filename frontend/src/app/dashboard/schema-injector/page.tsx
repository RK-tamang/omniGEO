"use client";

import { useState } from "react";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

interface SchemaResult {
  success: boolean;
  workerUrl?: string;
  deployedSchemas: string[];
  error?: string;
}

export default function SchemaInjectorPage() {
  const [domain, setDomain] = useState("");
  const [schemas, setSchemas] = useState<Array<{ type: string; data: Record<string, unknown> }>>([
    {
      type: "Organization",
      data: {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Your Company",
        url: "https://example.com",
        logo: "https://example.com/logo.png",
        sameAs: ["https://twitter.com/example", "https://linkedin.com/company/example"],
      },
    },
    {
      type: "WebSite",
      data: {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Your Site",
        url: "https://example.com",
        potentialAction: {
          "@type": "SearchAction",
          target: "https://example.com/search?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
    },
  ]);
  const [result, setResult] = useState<SchemaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addSchema = (type: string) => {
    const templates: Record<string, Record<string, unknown>> = {
      LocalBusiness: {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "Business Name",
        address: {
          "@type": "PostalAddress",
          streetAddress: "123 Main St",
          addressLocality: "City",
          addressRegion: "State",
          postalCode: "12345",
          addressCountry: "US",
        },
        telephone: "+1-555-123-4567",
      },
      Product: {
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Product Name",
        description: "Product description",
        brand: { "@type": "Brand", name: "Brand Name" },
        offers: {
          "@type": "Offer",
          price: "29.99",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      },
      Article: {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Article Title",
        author: { "@type": "Person", name: "Author Name" },
        datePublished: "2024-01-01",
        dateModified: "2024-01-01",
        publisher: { "@type": "Organization", name: "Publisher Name" },
      },
      FAQPage: {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Question 1?",
            acceptedAnswer: { "@type": "Answer", text: "Answer 1" },
          },
          {
            "@type": "Question",
            name: "Question 2?",
            acceptedAnswer: { "@type": "Answer", text: "Answer 2" },
          },
        ],
      },
    };

    setSchemas([...schemas, { type, data: templates[type] || { "@context": "https://schema.org", "@type": type } }]);
  };

  const removeSchema = (index: number) => {
    setSchemas(schemas.filter((_, i) => i !== index));
  };

  const updateSchemaData = (index: number, data: Record<string, unknown>) => {
    setSchemas(schemas.map((s, i) => (i === index ? { ...s, data } : s)));
  };

  const handleDeploy = async () => {
    if (!domain.trim() || schemas.length === 0) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/schema/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, schemas }),
      });
      const data = await res.json();
      setResult(data);
      if (!data.success) setError(data.error || "Deployment failed");
    } catch (e) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorker = async (workerName: string) => {
    try {
      await fetch(`/api/schema/inject?worker=${workerName}`, { method: "DELETE" });
      setResult(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <Panel title="Schema Injector" sub="Push dynamic JSON-LD to client headers via Cloudflare Workers (Free up to 100k req/day)">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mist mb-2">Target Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="w-full rounded-xl border border-line bg-surface-1 px-4 py-3 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-between">
            <h4 className="font-medium text-chalk">JSON-LD Schemas ({schemas.length})</h4>
            <div className="flex gap-2">
              {["Organization", "WebSite", "LocalBusiness", "Product", "Article", "FAQPage"].map((type) => (
                <Button key={type} variant="ghost" size="sm" onClick={() => addSchema(type)}>
                  + {type}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {schemas.map((schema, index) => (
              <div key={index} className="rounded-xl border border-line bg-surface-1 p-4">
                <div className="flex items-center justify-between mb-3">
                  <select
                    value={schema.type}
                    onChange={(e) => updateSchemaData(index, { ...schema.data, type: e.target.value })}
                    className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-chalk focus:border-iris/60 focus:outline-none"
                  >
                    {["Organization", "WebSite", "LocalBusiness", "Product", "Article", "FAQPage", "BreadcrumbList", "Service"].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => removeSchema(index)} className="text-coral">
                    Remove
                  </Button>
                </div>
                <textarea
                  value={JSON.stringify(schema.data, null, 2)}
                  onChange={(e) => {
                    try {
                      updateSchemaData(index, JSON.parse(e.target.value));
                    } catch {}
                  }}
                  className="w-full min-h-[150px] font-mono text-xs rounded-lg border border-line bg-surface-2 px-3 py-2 text-chalk placeholder:text-mist-dim focus:border-iris/60 focus:outline-none transition-colors"
                  rows={6}
                  spellCheck={false}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={handleDeploy} disabled={loading || !domain.trim() || schemas.length === 0}>
              {loading ? "Deploying..." : "Deploy to Cloudflare Workers"}
            </Button>
            {error && <span className="text-coral text-sm">{error}</span>}
          </div>

          <p className="text-xs text-mist-dim">
            Free tier: 100,000 requests/day • Workers auto-inject JSON-LD into HTML responses before {"</head>>>>>>>>>"}
          </p>
        </div>

        {result?.success && (
          <div className="mt-6 rounded-xl border border-mint/40 bg-mint/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-mint">Deployment Successful</h4>
              <Button variant="ghost" size="sm" onClick={() => handleDeleteWorker(result.workerUrl!.split(".")[0].split("//")[1])}>
                Delete Worker
              </Button>
            </div>
            <p className="text-sm text-mint mb-2">
              Worker URL: <a href={result.workerUrl} target="_blank" rel="noopener" className="underline">{result.workerUrl}</a>
            </p>
            <p className="text-sm text-mint">Deployed schemas: {result.deployedSchemas.join(", ")}</p>
            <p className="text-xs text-mint mt-2">Add this worker as a Cloudflare Zone rule to intercept HTML responses for your domain.</p>
          </div>
        )}
      </Panel>
    </div>
  );
}