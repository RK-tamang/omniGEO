"use client";

import { useState, useEffect } from "react";
import { Panel } from "@/components/dashboard/panel";
import { formatINR } from "@/lib/format";

interface BillingSummary {
  period: { start: string; end: string };
  totalCostUsd: number;
  totalCostNpr: number;
  breakdown: Array<{
    service: string;
    operations: number;
    costUsd: number;
    costNpr: number;
  }>;
  byWorkspace: Record<string, { costUsd: number; costNpr: number }>;
}

interface UsageRecord {
  id: string;
  service: string;
  operation: string;
  quantity: number;
  costUsd: number;
  costNpr: number;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export default function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState({ days: 30 });

  useEffect(() => {
    fetchBilling();
  }, [period.days]);

  const fetchBilling = async () => {
    setLoading(true);
    try {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - period.days * 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch(`/api/billing/usage?startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setRecords(data.records);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getServiceColor = (service: string) => {
    const colors: Record<string, string> = {
      dataforseo: "text-iris",
      crawler: "text-aqua",
      llm: "text-gold",
      payments: "text-coral",
    };
    return colors[service] || "text-mist";
  };

  return (
    <div className="space-y-6">
      <Panel title="Billing & Usage" sub="Track API usage and costs across all backend services">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="rounded-xl border border-line bg-surface-1 p-4">
            <p className="text-sm text-mist">Total Cost (USD)</p>
            <p className="text-2xl font-semibold text-chalk">${summary?.totalCostUsd.toFixed(2) || "0.00"}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-1 p-4">
            <p className="text-sm text-mist">Total Cost (NPR)</p>
            <p className="text-2xl font-semibold text-chalk">{formatINR(summary?.totalCostNpr || 0)}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-1 p-4">
            <p className="text-sm text-mist">API Calls</p>
            <p className="text-2xl font-semibold text-chalk">{records.length}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-1 p-4">
            <p className="text-sm text-mist">Period</p>
            <p className="text-sm font-medium text-chalk">{period.days} days</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-chalk">Cost Breakdown by Service</h4>
          <select
            value={period.days}
            onChange={(e) => setPeriod({ days: parseInt(e.target.value) })}
            className="rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-chalk"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>

        <div className="rounded-xl border border-line overflow-hidden mb-6">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-1 border-b border-line">
                <th className="px-4 py-3 text-left text-sm font-medium text-mist">Service</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-mist">Operations</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-mist">Cost (USD)</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-mist">Cost (NPR)</th>
              </tr>
            </thead>
            <tbody>
              {summary?.breakdown.map((item) => (
                <tr key={item.service} className="border-b border-line/50">
                  <td className="px-4 py-3">
                    <span className={`font-medium ${getServiceColor(item.service)}`}>{item.service}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-mist">{item.operations.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-chalk">${item.costUsd.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-chalk">{formatINR(item.costNpr)}</td>
                </tr>
              ))}
              <tr className="bg-surface-1 font-medium">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right">{summary?.breakdown.reduce((a, b) => a + b.operations, 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">${summary?.totalCostUsd.toFixed(4) || "0.0000"}</td>
                <td className="px-4 py-3 text-right">{formatINR(summary?.totalCostNpr || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-chalk">Recent Usage Records</h4>
          <span className="text-sm text-mist">{records.length} records</span>
        </div>

        <div className="rounded-xl border border-line overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-1 border-b border-line">
                <th className="px-4 py-3 text-left text-sm font-medium text-mist">Time</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-mist">Service</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-mist">Operation</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-mist">Qty</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-mist">Cost (USD)</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-mist">Details</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 50).map((record) => (
                <tr key={record.id} className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 text-sm text-mist">
                    {new Date(record.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${getServiceColor(record.service)}`}>{record.service}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-chalk">{record.operation}</td>
                  <td className="px-4 py-3 text-right text-sm text-mist">{record.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-chalk">${record.costUsd.toFixed(4)}</td>
                  <td className="px-4 py-3 text-xs text-mist max-w-xs truncate">
                    {JSON.stringify(record.metadata).slice(0, 80)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Panel title="Service Cost Reference" className="mt-6" level={2}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Service</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Operation</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-mist">Unit Cost</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Unit</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50"><td className="px-4 py-3 text-sm text-iris">DataForSEO</td><td className="px-4 py-3 text-sm">Keyword Ideas</td><td className="px-4 py-3 text-right font-mono text-sm">$0.01</td><td className="px-4 py-3 text-sm">research run</td></tr>
                <tr className="border-b border-line/50"><td className="px-4 py-3 text-sm text-iris">DataForSEO</td><td className="px-4 py-3 text-sm">Maps API (Geo-Grid)</td><td className="px-4 py-3 text-right font-mono text-sm">$0.0006</td><td className="px-4 py-3 text-sm">SERP request</td></tr>
                <tr className="border-b border-line/50"><td className="px-4 py-3 text-sm text-iris">DataForSEO</td><td className="px-4 py-3 text-sm">LLM Mentions</td><td className="px-4 py-3 text-right font-mono text-sm">$0.101</td><td className="px-4 py-3 text-sm">query call</td></tr>
                <tr className="border-b border-line/50"><td className="px-4 py-3 text-sm text-aqua">Crawler</td><td className="px-4 py-3 text-sm">Firecrawl / Jina AI</td><td className="px-4 py-3 text-right font-mono text-sm">$0.001</td><td className="px-4 py-3 text-sm">page</td></tr>
                <tr className="border-b border-line/50"><td className="px-4 py-3 text-sm text-gold">LLM</td><td className="px-4 py-3 text-sm">GPT-4o-mini (input)</td><td className="px-4 py-3 text-right font-mono text-sm">$0.15</td><td className="px-4 py-3 text-sm">1M tokens</td></tr>
                <tr className="border-b border-line/50"><td className="px-4 py-3 text-sm text-gold">LLM</td><td className="px-4 py-3 text-sm">GPT-4o-mini (output)</td><td className="px-4 py-3 text-right font-mono text-sm">$0.60</td><td className="px-4 py-3 text-sm">1M tokens</td></tr>
                <tr className="border-b border-line/50"><td className="px-4 py-3 text-sm text-gold">LLM</td><td className="px-4 py-3 text-sm">Claude 3.5 Haiku (input)</td><td className="px-4 py-3 text-right font-mono text-sm">$0.80</td><td className="px-4 py-3 text-sm">1M tokens</td></tr>
                <tr className="border-b border-line/50"><td className="px-4 py-3 text-sm text-gold">LLM</td><td className="px-4 py-3 text-sm">Claude 3.5 Haiku (output)</td><td className="px-4 py-3 text-right font-mono text-sm">$4.00</td><td className="px-4 py-3 text-sm">1M tokens</td></tr>
                <tr className="border-b border-line/50"><td className="px-4 py-3 text-sm text-coral">Payments</td><td className="px-4 py-3 text-sm">Transaction Fee</td><td className="px-4 py-3 text-right font-mono text-sm">2.0%</td><td className="px-4 py-3 text-sm">percentage</td></tr>
              </tbody>
            </table>
          </div>
        </Panel>
      </Panel>
    </div>
  );
}