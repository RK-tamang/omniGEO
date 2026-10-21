/**
 * Billing & Cost Tracking System
 * Tracks usage and costs across all backend services
 */

export interface ServiceCost {
  service: string;
  operation: string;
  unitCost: number;
  unit: string;
  quantity: number;
  totalCost: number;
  currency: "USD" | "NPR";
  timestamp: string;
}

export interface UsageRecord {
  id: string;
  userId: string;
  workspaceId: string;
  service: string;
  operation: string;
  quantity: number;
  costUsd: number;
  costNpr: number;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface BillingSummary {
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

export const SERVICE_COSTS: Record<string, Record<string, { cost: number; unit: string; currency: "USD" | "NPR" }>> = {
  dataforseo: {
    keyword_ideas: { cost: 0.01, unit: "research_run", currency: "USD" },
    maps_api: { cost: 0.0006, unit: "serp_request", currency: "USD" },
    llm_api: { cost: 0.101, unit: "query_call", currency: "USD" },
  },
  crawler: {
    firecrawl: { cost: 0.001, unit: "page", currency: "USD" },
    jina: { cost: 0.001, unit: "page", currency: "USD" },
  },
  llm: {
    "gpt-4o-mini": { cost: 0.15 / 1_000_000, unit: "input_token", currency: "USD" },
    "gpt-4o-mini-output": { cost: 0.60 / 1_000_000, unit: "output_token", currency: "USD" },
    "gpt-4o": { cost: 2.50 / 1_000_000, unit: "input_token", currency: "USD" },
    "gpt-4o-output": { cost: 10.00 / 1_000_000, unit: "output_token", currency: "USD" },
    "gpt-4-turbo": { cost: 10.00 / 1_000_000, unit: "input_token", currency: "USD" },
    "gpt-4-turbo-output": { cost: 30.00 / 1_000_000, unit: "output_token", currency: "USD" },
    "claude-3-5-haiku": { cost: 0.80 / 1_000_000, unit: "input_token", currency: "USD" },
    "claude-3-5-haiku-output": { cost: 4.00 / 1_000_000, unit: "output_token", currency: "USD" },
    "claude-3-5-sonnet": { cost: 3.00 / 1_000_000, unit: "input_token", currency: "USD" },
    "claude-3-5-sonnet-output": { cost: 15.00 / 1_000_000, unit: "output_token", currency: "USD" },
  },
  cloudflare: {
    workers: { cost: 0, unit: "request", currency: "USD" },
  },
  payments: {
    transaction_fee: { cost: 0.02, unit: "percentage", currency: "NPR" },
  },
};

const USD_TO_NPR = 132; // Approximate rate, should be fetched from exchange rate API

export class BillingTracker {
  private usageRecords: UsageRecord[] = [];

  recordUsage(record: Omit<UsageRecord, "id" | "timestamp">): UsageRecord {
    const fullRecord: UsageRecord = {
      ...record,
      id: `usage_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      costNpr: record.costUsd * USD_TO_NPR,
    };
    this.usageRecords.push(fullRecord);
    return fullRecord;
  }

  recordDataForSEOUsage(
    userId: string,
    workspaceId: string,
    operation: "keyword_ideas" | "maps_api" | "llm_api",
    quantity: number,
    metadata: Record<string, unknown> = {}
  ): UsageRecord {
    const costInfo = SERVICE_COSTS.dataforseo[operation];
    const costUsd = costInfo.cost * quantity;
    return this.recordUsage({
      userId,
      workspaceId,
      service: "dataforseo",
      operation,
      quantity,
      costUsd,
      costNpr: costUsd * USD_TO_NPR,
      metadata,
    });
  }

  recordCrawlerUsage(
    userId: string,
    workspaceId: string,
    provider: "firecrawl" | "jina",
    pagesCrawled: number,
    metadata: Record<string, unknown> = {}
  ): UsageRecord {
    const costInfo = SERVICE_COSTS.crawler[provider];
    const costUsd = costInfo.cost * pagesCrawled;
    return this.recordUsage({
      userId,
      workspaceId,
      service: "crawler",
      operation: provider,
      quantity: pagesCrawled,
      costUsd,
      costNpr: costUsd * USD_TO_NPR,
      metadata,
    });
  }

  recordLLMUsage(
    userId: string,
    workspaceId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    metadata: Record<string, unknown> = {}
  ): UsageRecord {
    // Fall back to the cheapest known base model so unexpected IDs (e.g. a
    // model the backend adds later) still bill at a sane rate instead of NaN.
    const base = SERVICE_COSTS.llm[model] ? model : "gpt-4o-mini";
    const inputCost = SERVICE_COSTS.llm[base].cost * inputTokens;
    const outputCost = SERVICE_COSTS.llm[`${base}-output`].cost * outputTokens;
    const costUsd = inputCost + outputCost;
    return this.recordUsage({
      userId,
      workspaceId,
      service: "llm",
      operation: model,
      quantity: inputTokens + outputTokens,
      costUsd,
      costNpr: costUsd * USD_TO_NPR,
      metadata: { inputTokens, outputTokens, ...metadata },
    });
  }

  recordPaymentFee(
    userId: string,
    workspaceId: string,
    amountNpr: number,
    provider: "esewa" | "khalti",
    metadata: Record<string, unknown> = {}
  ): UsageRecord {
    const costNpr = amountNpr * SERVICE_COSTS.payments.transaction_fee.cost;
    const costUsd = costNpr / USD_TO_NPR;
    return this.recordUsage({
      userId,
      workspaceId,
      service: "payments",
      operation: `transaction_fee_${provider}`,
      quantity: 1,
      costUsd,
      costNpr,
      metadata: { amountNpr, provider, ...metadata },
    });
  }

  getUsageRecords(filters?: {
    userId?: string;
    workspaceId?: string;
    service?: string;
    startDate?: string;
    endDate?: string;
  }): UsageRecord[] {
    return this.usageRecords.filter((record) => {
      if (filters?.userId && record.userId !== filters.userId) return false;
      if (filters?.workspaceId && record.workspaceId !== filters.workspaceId) return false;
      if (filters?.service && record.service !== filters.service) return false;
      if (filters?.startDate && record.timestamp < filters.startDate) return false;
      if (filters?.endDate && record.timestamp > filters.endDate) return false;
      return true;
    });
  }

  getBillingSummary(
    userId: string,
    startDate: string,
    endDate: string
  ): BillingSummary {
    const records = this.getUsageRecords({ userId, startDate, endDate });

    const totalCostUsd = records.reduce((sum, r) => sum + r.costUsd, 0);
    const totalCostNpr = records.reduce((sum, r) => sum + r.costNpr, 0);

    const serviceBreakdown = records.reduce((acc, record) => {
      if (!acc[record.service]) {
        acc[record.service] = { operations: 0, costUsd: 0, costNpr: 0 };
      }
      acc[record.service].operations += record.quantity;
      acc[record.service].costUsd += record.costUsd;
      acc[record.service].costNpr += record.costNpr;
      return acc;
    }, {} as Record<string, { operations: number; costUsd: number; costNpr: number }>);

    const byWorkspace = records.reduce((acc, record) => {
      if (!acc[record.workspaceId]) {
        acc[record.workspaceId] = { costUsd: 0, costNpr: 0 };
      }
      acc[record.workspaceId].costUsd += record.costUsd;
      acc[record.workspaceId].costNpr += record.costNpr;
      return acc;
    }, {} as Record<string, { costUsd: number; costNpr: number }>);

    return {
      period: { start: startDate, end: endDate },
      totalCostUsd,
      totalCostNpr,
      breakdown: Object.entries(serviceBreakdown).map(([service, data]) => ({
        service,
        ...data,
      })),
      byWorkspace,
    };
  }

  estimateOperationCost(
    service: string,
    operation: string,
    quantity: number,
    extra?: { inputTokens?: number; outputTokens?: number }
  ): { costUsd: number; costNpr: number } {
    let costUsd = 0;

    if (service === "dataforseo") {
      costUsd = SERVICE_COSTS.dataforseo[operation]?.cost * quantity || 0;
    } else if (service === "crawler") {
      costUsd = SERVICE_COSTS.crawler[operation]?.cost * quantity || 0;
    } else if (service === "llm") {
      const inputTokens = extra?.inputTokens || 0;
      const outputTokens = extra?.outputTokens || 0;
      costUsd = SERVICE_COSTS.llm[operation]?.cost * inputTokens || 0;
      costUsd += SERVICE_COSTS.llm[`${operation}-output`]?.cost * outputTokens || 0;
    } else if (service === "payments") {
      costUsd = (quantity * SERVICE_COSTS.payments.transaction_fee.cost) / USD_TO_NPR;
    }

    return { costUsd, costNpr: costUsd * USD_TO_NPR };
  }
}

let billingTracker: BillingTracker | null = null;

export function getBillingTracker(): BillingTracker {
  if (!billingTracker) billingTracker = new BillingTracker();
  return billingTracker;
}