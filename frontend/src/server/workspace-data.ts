import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendEnabled, backendFetch } from "@/server/backend-client";
import type { WorkspaceData } from "@/hooks/use-workspace-data";

/**
 * Server-side reads of the workspace's live data.
 *
 * The browser-facing route at `/api/workspace/data` exposes the same payload
 * to client components; these helpers let server components read it directly
 * during a render.
 */

async function backendToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session?.backendToken) return null;
  return session.backendToken;
}

/** Every row the backend holds for this workspace, or null when unavailable. */
export async function getWorkspaceData(): Promise<WorkspaceData | null> {
  if (!backendEnabled()) return null;
  const token = await backendToken();
  if (!token) return null;

  const result = await backendFetch<WorkspaceData>("/api/workspace/data", {
    method: "GET",
    token,
  });

  return result.ok && result.data ? result.data : null;
}

export type BotAccess = {
  bot: string;
  owner: string;
  purpose: string;
  status: "allowed" | "blocked" | "limited";
  rule?: string | null;
};

export type CrawlerAccess = {
  domain: string;
  found: boolean;
  status: number;
  body: string;
  bots: BotAccess[];
  fetchedAt: string;
};

/** The workspace domain's real robots.txt and the per-bot verdict it implies. */
export async function getCrawlerAccess(): Promise<CrawlerAccess | null> {
  if (!backendEnabled()) return null;
  const token = await backendToken();
  if (!token) return null;

  const result = await backendFetch<CrawlerAccess>("/api/crawler/robots", {
    method: "GET",
    token,
  });

  return result.ok && result.data ? result.data : null;
}
