"use client";

import { useEffect, useState } from "react";

/**
 * Live workspace data from the backend.
 *
 * The dashboard shows what the workspace has actually tracked, generated and
 * crawled. There is no static dataset underneath it — a workspace with no rows
 * renders an empty state rather than invented numbers.
 *
 * `source` tells you which mode you are in: "backend" when the rows came from
 * the API, "local" when no backend is reachable.
 */

export type WorkspaceData = {
  workspace?: {
    id?: string;
    name?: string;
    plan?: string;
    settings?: {
      whitelist?: string[];
      timezone?: string;
      locale?: string;
      competitors?: string;
      runDay?: string;
      digest?: string;
      emailDigest?: boolean;
      criticalAlerts?: boolean;
      productUpdates?: boolean;
    } | null;
  } | null;
  domains?: Array<{ id?: string; domain: string; isPrimary?: boolean }>;
  prompts?: Array<{
    id: string;
    prompt: string;
    type: string;
    status: string;
    engines?: Record<string, string>;
    targetPrompt?: string | null;
    sentiment?: string;
    createdAt?: string | number | null;
    updatedAt?: string | number | null;
  }>;
  citations?: Array<{
    id: string;
    promptId?: string | null;
    engine: string;
    domain: string;
    url: string;
    title?: string | null;
    position?: number | null;
    capturedAt?: string | number | null;
  }>;
  contentItems?: Array<{
    id: string;
    title: string;
    status: string;
    score?: number | null;
    targetPrompt?: string | null;
    wordCount?: number | null;
    citations?: number | null;
    updatedAt?: string | number | null;
  }>;
  scans?: Array<{
    id: string;
    type: string;
    status: string;
    score?: number | null;
    result?: Record<string, any> | null;
    checks?: Array<{ name: string; status: string; details: string }> | null;
    pagesAnalyzed?: number | null;
    issuesFound?: number | null;
    createdAt?: string | number | null;
  }>;
  crawls?: Array<{
    id: string;
    url: string;
    status: string;
    pagesCrawled?: number | null;
    result?: Record<string, any> | null;
    createdAt?: string | number | null;
    completedAt?: string | number | null;
  }>;
  auditIssues?: Array<{
    id: string;
    category: string;
    severity: string;
    title: string;
    description: string;
    fix: string;
    pagesAffected?: number | null;
    impact?: string | null;
    effort?: string | null;
    status?: string | null;
    createdAt?: string | number | null;
  }>;
  competitors?: Array<{
    id: string;
    name: string;
    domain?: string | null;
    visibilityScore?: number | null;
    citationsCount?: number | null;
    promptsWon?: number | null;
    topCitations?: string[] | null;
    lastCheckedAt?: string | number | null;
  }>;
  competitorPrompts?: Array<{
    id: string;
    competitorId: string;
    promptId: string;
    engine: string;
    status: string;
    position?: number | null;
    citationUrl?: string | null;
    capturedAt?: string | number | null;
  }>;
  alerts?: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    createdAt?: string | number | null;
  }>;
  reports?: Array<{
    id: string;
    name: string;
    type: string;
    format: string;
    status: string;
    createdAt?: string | number | null;
  }>;
  webhooks?: Array<{
    id: string;
    url: string;
    events?: string[] | null;
    active?: boolean | null;
    lastTriggeredAt?: string | number | null;
    failureCount?: number | null;
  }>;
};

export type WorkspaceDataState = {
  /** Live rows, or null when no backend is reachable. */
  data: WorkspaceData | null;
  loading: boolean;
  source: "backend" | "local";
};

export function useWorkspaceData(): WorkspaceDataState {
  const [state, setState] = useState<WorkspaceDataState>({
    data: null,
    loading: true,
    source: "local",
  });

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const res = await fetch("/api/workspace/data", { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          data?: WorkspaceData | null;
          source?: "backend" | "local";
        };
        if (!active) return;
        setState({
          data: body.ok && body.data ? body.data : null,
          loading: false,
          source: body.source === "backend" ? "backend" : "local",
        });
      } catch {
        if (!active) return;
        setState({ data: null, loading: false, source: "local" });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return state;
}
