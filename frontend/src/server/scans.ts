import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendEnabled, backendFetch } from "@/server/backend-client";
import type { BotVerdict, BackendIssue, BackendPrompt, BackendScan } from "@/lib/scan-data";

/** The backend auth_token carried in the signed session cookie, if any. */
export async function sessionBackendToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  return session?.backendToken ?? null;
}

export type ScanReportData = {
  domain: string;
  scans: BackendScan[];
  issues: BackendIssue[];
  prompts: BackendPrompt[];
  bots: BotVerdict[];
  robotsFound: boolean;
  simulated: boolean;
};

/**
 * Everything a scan report needs, read from the backend.
 *
 * The report is assembled from the workspace's own scans: the audit scan's
 * checks and issues, the visibility scan's engine results, and the live
 * robots.txt verdict for the domain that was scanned.
 */
export async function getScanReportData(
  scanId: string,
  fallbackDomain?: string,
): Promise<ScanReportData | null> {
  if (!backendEnabled()) return null;
  const token = await sessionBackendToken();
  if (!token) return null;

  const list = await backendFetch<{ scans: BackendScan[] }>("/api/scans?limit=50", {
    method: "GET",
    token,
  });
  if (!list.ok || !Array.isArray(list.data?.scans)) return null;

  const scans = list.data.scans;
  const primary = scans.find((s) => s.id === scanId);
  if (!primary) return null;

  const workspace = await backendFetch<{
    prompts?: BackendPrompt[];
    auditIssues?: BackendIssue[];
  }>("/api/workspace/data", { method: "GET", token });

  const domain =
    (primary.result?.domain as string | undefined) ??
    (primary.input?.domain as string | undefined) ??
    fallbackDomain ??
    "";

  const robots = domain
    ? await backendFetch<{ found: boolean; bots: BotVerdict[] }>(
        `/api/crawler/robots?domain=${encodeURIComponent(domain)}`,
        { method: "GET", token },
      )
    : null;

  return {
    domain,
    scans,
    issues: workspace.ok ? (workspace.data?.auditIssues ?? []) : [],
    prompts: workspace.ok ? (workspace.data?.prompts ?? []) : [],
    bots: robots?.ok ? (robots.data?.bots ?? []) : [],
    robotsFound: Boolean(robots?.ok && robots.data?.found),
    simulated: Boolean(primary.result?.simulated),
  };
}
