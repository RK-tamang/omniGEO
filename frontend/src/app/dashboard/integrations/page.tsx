"use client";

import { useEffect, useState } from "react";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import api from "@/lib/api-client";

const OTHER_INTEGRATIONS = [
  { name: "Google Search Console", status: "disconnected", desc: "Search and indexing data" },
  { name: "Google Analytics 4", status: "disconnected", desc: "Traffic and conversion analytics" },
  { name: "PageSpeed Insights", status: "disconnected", desc: "Core Web Vitals and performance" },
  { name: "OpenAI", status: "unconfigured", desc: "AI Visibility model responses" },
  { name: "Gemini", status: "unconfigured", desc: "Google Search grounding" },
  { name: "Perplexity", status: "unconfigured", desc: "Grounded AI answers" },
  { name: "SerpApi", status: "unconfigured", desc: "Google AI Overview observations" },
  { name: "WordPress", status: "unsupported", desc: "CMS sync and publishing" },
];

export default function IntegrationsPage() {
  const [dfStatus, setDfStatus] = useState<any>(null);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const init = async () => {
      try {
        const ws = await api.getWorkspaces();
        if (ws.ok && ws.data?.workspaces?.length > 0) {
          setProjectId(ws.data.workspaces[0].id);
        }
      } catch {}
    };
    init();
  }, []);

  useEffect(() => {
    if (!projectId) return;
    api.getDataForSeoStatus(projectId).then((res) => {
      if (res.ok) setDfStatus(res.data);
    });
  }, [projectId]);

  const connected = dfStatus?.connected ?? false;
  const capabilities = dfStatus?.capabilities ?? [];
  const lastSeen = dfStatus?.last_successful_collection ?? null;
  const failures = dfStatus?.provider_failures ?? 0;

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Integrations"
        sub="Connect CMS platforms, Google services, and AI providers"
        aside={<Button size="sm">Add Integration</Button>}
      />

      {/* DataForSEO AI Provider Card */}
      <Panel title="DataForSEO AI Search Intelligence" level={2} className="lg:col-span-3">
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium text-chalk">DataForSEO</p>
            <p className="text-xs text-mist-dim">
              AI search visibility across ChatGPT, Gemini, Google AI Overviews and AI Mode
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${
              connected ? "bg-mint/15 text-mint border-mint/30" : "bg-coral/15 text-coral border-coral/30"
            }`}>
              {connected ? "Connected" : "Not Configured"}
            </span>
                <Button
                  size="sm"
                  variant={connected ? "outline" : undefined}
                  onClick={() => {
                    // Placeholder: credentials are configured server-side via env vars
                  }}
                >
                  {connected ? "Manage" : "Configure"}
                </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl border border-line bg-surface/50 p-4">
            <p className="font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim mb-2">Status</p>
            <p className="text-sm font-medium text-chalk">
              {connected ? "Connected — provider credentials configured" : "Not connected — set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD"}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface/50 p-4">
            <p className="font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim mb-2">Capabilities</p>
            <p className="text-sm text-mist-dim">{capabilities.length ? capabilities.join(", ") : "None configured"}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface/50 p-4">
            <p className="font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim mb-2">Last Collection</p>
            <p className="text-sm font-medium text-chalk">{lastSeen ? new Date(lastSeen).toLocaleDateString() : "—"}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface/50 p-4">
            <p className="font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim mb-2">Failures</p>
            <p className="text-sm font-medium text-chalk">{failures}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-surface/50 p-4">
          <p className="font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim mb-2">Supported APIs</p>
          <div className="flex flex-wrap gap-2">
            {[
              "ChatGPT LLM Scraper",
              "Gemini LLM Scraper",
              "Google AI Overviews",
              "Google AI Mode",
              "LLM Mentions",
              "AI Keyword Data",
            ].map((cap) => (
              <span key={cap} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-1 text-[0.55rem] font-medium text-mist-dim">
                {cap}
              </span>
            ))}
          </div>
        </div>
      </Panel>

      {/* Other integrations */}
      <Panel title="Other Integrations" level={2} className="lg:col-span-3">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {OTHER_INTEGRATIONS.map((integ) => (
            <Panel key={integ.name} title={integ.name} level={3} className="lg:col-span-3">
              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-medium text-chalk">{integ.name}</p>
                  <p className="text-xs text-mist-dim">{integ.desc}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${
                    integ.status === "connected"
                      ? "bg-mint/15 text-mint border-mint/30"
                      : integ.status === "disconnected"
                        ? "bg-mist/15 text-mist border-mist/30"
                        : integ.status === "unconfigured"
                          ? "bg-mist/15 text-mist border-mist/30"
                          : "bg-coral/15 text-coral border-coral/30"
                  }`}>
                    {integ.status === "connected" ? "Connected" : integ.status === "disconnected" ? "Disconnected" : integ.status === "unconfigured" ? "Unconfigured" : "Unsupported"}
                  </span>
                  <Button size="sm" variant="outline">
                    {integ.status === "connected" ? "Manage" : integ.status === "unconfigured" ? "Configure" : "Connect"}
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </Panel>

      <Panel title="CMS Connected Sites" level={2}>
        <EmptyState title="No CMS connections" sub="Connect WordPress or other CMS platforms for content sync." />
      </Panel>
    </div>
  );
}
