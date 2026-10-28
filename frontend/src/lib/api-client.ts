// Client-side API client for the OmniGEO API.
// All requests go to the backend at BACKEND_URL (default http://localhost:8080).

function getApiBaseUrl(): string {
  return (
    (typeof process !== "undefined" && process.env.BACKEND_URL) ||
    "http://localhost:8080"
  );
}

async function apiFetch<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
    token?: string;
  } = {},
): Promise<{ ok: boolean; data?: T; error?: string; status?: number }> {
  const url = path.startsWith("http") ? path : `${getApiBaseUrl()}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }
  try {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    return {
      ok: res.ok,
      data,
      error: res.ok ? undefined : (data as any)?.error || res.statusText,
      status: res.status,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Request failed",
      status: undefined,
    };
  }
}

export const backendFetch = apiFetch;
export const apiFetchDirect = apiFetch;

/** Check if backend is configured (backend URL is set). */
export function backendEnabled(): boolean {
  return typeof process !== "undefined" && Boolean(process.env.BACKEND_URL);
}

export { apiFetch };

/** Auth session helpers: cookie-based session tokens. */
export const SESSION_COOKIE = "answerscope_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type Session = {
  email: string;
  name: string;
  plan: string;
  exp: number; // unix seconds
  backendToken?: string;
  userId?: string;
  workspaceId?: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function secret() {
  return process.env.AUTH_SECRET ?? "omnigeo-dev-secret-change-in-production";
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

function toBase64Url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey() {
  const base = await crypto.subtle.digest("SHA-256", encoder.encode(secret()));
  return crypto.subtle.importKey("raw", base, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function createSessionToken(session: Session): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(session)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;

  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = toBase64Url(
    new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(body))),
  );
  if (expected !== sig) return null;

  const bytes = fromBase64Url(body);
  if (!bytes) return null;

  try {
    const session = JSON.parse(decoder.decode(bytes)) as Session;
    if (!session?.email || typeof session.exp !== "number") return null;
    if (session.exp * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/** Accept only same-origin relative paths, to avoid open redirects. */
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

// ============================================================================
// API Client Functions
// ============================================================================

export async function getOverview() {
  return apiFetch<any>("/api/v1/visibility/overview");
}

export async function getTrends() {
  return apiFetch<any>("/api/v1/visibility/trends");
}

export async function getPrompts() {
  return apiFetch<any>("/api/v1/visibility/prompts");
}

export async function createPrompt(body: any) {
  return apiFetch<any>("/api/v1/visibility/prompts", { method: "POST", body });
}

export async function deletePrompt(id: string) {
  return apiFetch<any>(`/api/v1/visibility/prompts/${id}`, { method: "DELETE" });
}

export async function generatePrompts(body: any) {
  return apiFetch<any>("/api/v1/visibility/prompts/generate", { method: "POST", body });
}

export async function getEngines() {
  return apiFetch<any>("/api/v1/visibility/engines");
}

export async function getCitationsOverview() {
  return apiFetch<any>("/api/v1/visibility/citations/overview");
}

export async function getCitationsTrends() {
  return apiFetch<any>("/api/v1/visibility/citations/trends");
}

export async function getCitationsDomains() {
  return apiFetch<any>("/api/v1/visibility/citations/domains");
}

export async function getCitationsPages() {
  return apiFetch<any>("/api/v1/visibility/citations/pages");
}

export async function getCitationsGaps() {
  return apiFetch<any>("/api/v1/visibility/citations/gaps");
}

export async function getCompetitors() {
  return apiFetch<any>("/api/v1/visibility/competitors");
}

export async function getCompetitorGaps() {
  return apiFetch<any>("/api/v1/visibility/competitor-gaps");
}

export async function getWorkspaces() {
  return apiFetch<any>("/api/workspace/data");
}

export async function startGeoAudit(body: any) {
  return apiFetch<any>("/api/v1/tools/geo-audit/runs", { method: "POST", body });
}

export async function getAuditRuns() {
  return apiFetch<any>("/api/v1/audits");
}

export async function getAudit(auditId: string) {
  return apiFetch<any>(`/api/v1/audits/${auditId}`);
}

export async function getAuditSummary(auditId: string) {
  return apiFetch<any>(`/api/v1/audits/${auditId}/summary`);
}

export async function getAuditScores(auditId: string) {
  return apiFetch<any>(`/api/v1/audits/${auditId}/scores`);
}

export async function getAuditFindings(auditId: string) {
  return apiFetch<any>(`/api/v1/audits/${auditId}/findings`);
}

export async function getAuditPages(auditId: string) {
  return apiFetch<any>(`/api/v1/audits/${auditId}/pages`);
}

export async function getJobs() {
  return apiFetch<any>("/api/v1/jobs");
}

export async function getScan(domain: string) {
  return apiFetch<any>("/api/v1/tools/geo-audit/runs", {
    method: "POST",
    body: { url: `https://${domain}` },
  });
}

export async function getScanResults(scanId: string, token?: string) {
  return backendFetch<any>(`/api/v1/tools/geo-audit/${scanId}/results`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function getProviders() {
  return backendFetch<any>("/api/v1/visibility/providers");
}

export async function getProviderStatus() {
  return backendFetch<any>("/api/v1/visibility/providers/status");
}

export async function getSchedules() {
  return backendFetch<any>("/api/v1/visibility/schedules");
}

export async function createSchedule(body: any) {
  return backendFetch<any>("/api/v1/visibility/schedules", { method: "POST", body });
}

export async function getUsage() {
  return backendFetch<any>("/api/v1/visibility/usage");
}

export async function getCredits() {
  return backendFetch<any>("/api/v1/visibility/credits");
}

export async function getMetrics() {
  return backendFetch<any>("/api/v1/visibility/metrics");
}

export async function getReports() {
  return backendFetch<any>("/api/v1/reports");
}

export async function createReport(body: any) {
  return apiFetch<any>("/api/v1/reports", { method: "POST", body });
}

export async function getIntegrationAvailability() {
  return apiFetch<any>("/api/v1/integrations/availability");
}

// Auth helpers
export async function backendLoginWithToken(email: string, password: string) {
  return apiFetch<any>("/api/v1/auth/login", { method: "POST", body: { email, password } });
}

export const loginWithToken = backendLoginWithToken;

export async function backendRegisterWithToken(body: any) {
  return apiFetch<any>("/api/v1/auth/register", { method: "POST", body });
}

export const registerWithToken = backendRegisterWithToken;

export async function backendGuestWithToken(body: { plan?: string } = {}) {
  return apiFetch<any>("/api/v1/auth/guest", { method: "POST", body });
}

export const guestWithToken = backendGuestWithToken;

export async function backendMe(token: string) {
  return apiFetch<any>("/api/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } });
}

export const me = backendMe;

export async function backendAuthUser(token: string) {
  return apiFetch<any>("/api/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } });
}

export async function getAuthUser(token: string) {
  return apiFetch<any>("/api/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } });
}

export async function getAuthUserWithBackendToken(token: string) {
  return apiFetch<any>("/api/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } });
}

export async function saveContact(body: any) {
  return apiFetch<any>("/api/v1/contact", { method: "POST", body });
}

export async function getOpenAIClient() {
  return { apiKey: process.env.OPENAI_API_KEY };
}

export async function getAnthropicClient() {
  return { apiKey: process.env.ANTHROPIC_API_KEY };
}

export async function getBillingTracker() {
  return apiFetch<any>("/api/v1/billing/usage");
}

export async function getCrawlerClient() {
  return { baseUrl: getApiBaseUrl() };
}

export async function recordLLMUsage(body: any) {
  return apiFetch<any>("/api/v1/billing/usage", { method: "POST", body });
}

export async function recordCrawlerUsage(body: any) {
  return apiFetch<any>("/api/v1/crawler/bulk", { method: "POST", body });
}

export async function bulkCrawl(body: any) {
  return apiFetch<any>("/api/v1/crawler/bulk", { method: "POST", body });
}

export async function getProjects() {
  return apiFetch<any>("/api/v1/workspace/projects");
}

// ============================================================================
// DataForSEO dashboard routes (read-only, stored observations)
// ============================================================================

export async function getDashboardOverview(projectId: string, query?: { limit?: number; days?: number }) {
  const params = new URLSearchParams();
  if (query?.limit) params.set("limit", String(query.limit));
  if (query?.days) params.set("days", String(query.days));
  const qs = params.toString() ? `?${params}` : "";
  return apiFetch<any>(`/api/v1/projects/${encodeURIComponent(projectId)}/dashboard/overview${qs}`);
}

export async function getVisibilityOverview(projectId: string, query?: { limit?: number; days?: number }) {
  const params = new URLSearchParams();
  if (query?.limit) params.set("limit", String(query.limit));
  if (query?.days) params.set("days", String(query.days));
  const qs = params.toString() ? `?${params}` : "";
  return apiFetch<any>(`/api/v1/projects/${encodeURIComponent(projectId)}/visibility/overview${qs}`);
}

export async function getVisibilityEngines(projectId: string, query?: { limit?: number; days?: number }) {
  const params = new URLSearchParams();
  if (query?.limit) params.set("limit", String(query.limit));
  if (query?.days) params.set("days", String(query.days));
  const qs = params.toString() ? `?${params}` : "";
  return apiFetch<any>(`/api/v1/projects/${encodeURIComponent(projectId)}/visibility/engines${qs}`);
}

export async function getVisibilityPrompts(projectId: string, query?: { limit?: number; days?: number }) {
  const params = new URLSearchParams();
  if (query?.limit) params.set("limit", String(query.limit));
  if (query?.days) params.set("days", String(query.days));
  const qs = params.toString() ? `?${params}` : "";
  return apiFetch<any>(`/api/v1/projects/${encodeURIComponent(projectId)}/visibility/prompts${qs}`);
}

export async function getVisibilityHistory(projectId: string, query?: { limit?: number; days?: number }) {
  const params = new URLSearchParams();
  if (query?.limit) params.set("limit", String(query.limit));
  if (query?.days) params.set("days", String(query.days));
  const qs = params.toString() ? `?${params}` : "";
  return apiFetch<any>(`/api/v1/projects/${encodeURIComponent(projectId)}/visibility/history${qs}`);
}

export async function startVisibilityRun(projectId: string, body: any) {
  return apiFetch<any>(`/api/v1/projects/${encodeURIComponent(projectId)}/visibility/runs`, {
    method: "POST",
    body,
  });
}

export async function getVisibilityCompetitors(projectId: string, query?: { limit?: number; days?: number }) {
  const params = new URLSearchParams();
  if (query?.limit) params.set("limit", String(query.limit));
  if (query?.days) params.set("days", String(query.days));
  const qs = params.toString() ? `?${params}` : "";
  return apiFetch<any>(`/api/v1/projects/${encodeURIComponent(projectId)}/visibility/competitors${qs}`);
}

export async function getMonitoringSchedules(projectId: string) {
  return apiFetch<any>(`/api/v1/projects/${encodeURIComponent(projectId)}/visibility/monitoring/schedules`);
}

export async function getMonitoringAlerts(projectId: string) {
  return apiFetch<any>(`/api/v1/projects/${encodeURIComponent(projectId)}/visibility/monitoring/alerts`);
}

export async function getVisibilityReports(projectId: string) {
  return apiFetch<any>(`/api/v1/projects/${encodeURIComponent(projectId)}/visibility/reports`);
}

export async function getDataForSeoStatus(projectId: string) {
  return apiFetch<any>(`/api/v1/projects/${encodeURIComponent(projectId)}/integrations/dataforseo/status`);
}

export async function getDataForSeoCapabilities(projectId: string) {
  return apiFetch<any>(`/api/v1/projects/${encodeURIComponent(projectId)}/integrations/dataforseo/capabilities`);
}

export async function getDataForSeoUsage(projectId: string) {
  return apiFetch<any>(`/api/v1/projects/${encodeURIComponent(projectId)}/integrations/dataforseo/usage`);
}

export async function getProjectOpportunities(projectId: string, query?: { limit?: number; days?: number }) {
  const params = new URLSearchParams();
  if (query?.limit) params.set("limit", String(query.limit));
  if (query?.days) params.set("days", String(query.days));
  const qs = params.toString() ? `?${params}` : "";
  return apiFetch<any>(`/api/v1/projects/${encodeURIComponent(projectId)}/opportunities${qs}`);
}

export async function getBillingUsage() {
  return apiFetch<any>("/api/v1/billing/usage");
}

// ============================================================================
// Default export additions
// ============================================================================

export default {
  getOverview,
  getTrends,
  getPrompts,
  createPrompt,
  deletePrompt,
  generatePrompts,
  getEngines,
  getCitationsOverview,
  getCitationsTrends,
  getCitationsDomains,
  getCitationsPages,
  getCitationsGaps,
  getCompetitors,
  getCompetitorGaps,
  getWorkspaces,
  startGeoAudit,
  getAuditRuns,
  getAudit,
  getAuditSummary,
  getAuditScores,
  getAuditFindings,
  getAuditPages,
  getJobs,
  getScan,
  createReport,
  getIntegrationAvailability,
  backendLoginWithToken,
  loginWithToken,
  backendRegisterWithToken,
  registerWithToken,
  backendGuestWithToken,
  guestWithToken,
  backendMe,
  me,
  backendAuthUser,
  getAuthUser,
  getAuthUserWithBackendToken,
  saveContact,
  getOpenAIClient,
  getAnthropicClient,
  getBillingTracker,
  getCrawlerClient,
  recordLLMUsage,
  recordCrawlerUsage,
  bulkCrawl,
  backendFetch,
  apiFetch,
  apiFetchDirect,
  backendEnabled,
  getUsage,
  getCredits,
  getSchedules,
  getProjects,
  getDashboardOverview,
  getVisibilityOverview,
  getVisibilityEngines,
  getVisibilityPrompts,
  getVisibilityHistory,
  startVisibilityRun,
  getVisibilityCompetitors,
  getMonitoringSchedules,
  getMonitoringAlerts,
  getVisibilityReports,
  getDataForSeoStatus,
  getDataForSeoCapabilities,
  getDataForSeoUsage,
  getProjectOpportunities,
  getBillingUsage,
} as unknown as Record<string, (...args: any[]) => Promise<any>>;

/** Default API object used by scan/results polling and dashboard pages. */
export const api = {
  getScanResults(id: string, token?: string) {
    return backendFetch<any>(`/api/v1/tools/geo-audit/${encodeURIComponent(id)}/results`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  },
  getPrompts() {
    return apiFetch<any>("/api/v1/visibility/prompts");
  },
  getAudit(auditId: string) {
    return apiFetch<any>(`/api/v1/audits/${encodeURIComponent(auditId)}`);
  },
  getAuditSummary(auditId: string) {
    return apiFetch<any>(`/api/v1/audits/${encodeURIComponent(auditId)}/summary`);
  },
  getAuditScores(auditId: string) {
    return apiFetch<any>(`/api/v1/audits/${encodeURIComponent(auditId)}/scores`);
  },
  getAuditFindings(auditId: string) {
    return apiFetch<any>(`/api/v1/audits/${encodeURIComponent(auditId)}/findings`);
  },
  getAuditPages(auditId: string) {
    return apiFetch<any>(`/api/v1/audits/${encodeURIComponent(auditId)}/pages`);
  },
  getJobs() {
    return apiFetch<any>("/api/v1/jobs");
  },
  getUsage() {
    return apiFetch<any>("/api/v1/visibility/usage");
  },
  getCredits() {
    return apiFetch<any>("/api/v1/visibility/credits");
  },
};
