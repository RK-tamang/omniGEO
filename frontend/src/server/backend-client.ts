// Server-only client for the OmniGEO Fastify backend (default http://localhost:3001).
//
// The Next.js route handlers own the browser-facing session cookie; the backend
// owns users/workspaces/scans/billing. This client is what lets the Next routes
// proxy work to the backend with a single source of truth.
//
// When BACKEND_URL is unset (or OMNI_BACKEND=off) every call reports
// `configured: false` and callers fall back to their local implementation, so
// the frontend keeps working with no backend running.

export const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:3001").replace(/\/$/, "");

export function backendEnabled(): boolean {
  if (process.env.OMNI_BACKEND === "off") return false;
  return Boolean(process.env.BACKEND_URL);
}

export type BackendUser = {
  id: string;
  email: string;
  name: string;
  plan: string;
  workspaceId: string;
  workspaceName?: string;
};

export type BackendResult<T> =
  | { ok: true; configured: true; status: number; data: T }
  | { ok: false; configured: true; status: number; data: null; error: string }
  | { ok: false; configured: false; status: 0; data: null; error: string };

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Call a backend endpoint. `cookie` is the raw auth_token cookie value obtained
 * from the backend login call (kept server-side in the Next session cookie).
 */
export async function backendFetch<T = any>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    token?: string;
    timeoutMs?: number;
    /** Forwards the tenant context when the backend is addressed without a session. */
    workspaceId?: string;
  } = {},
): Promise<BackendResult<T>> {
  if (!backendEnabled()) {
    return { ok: false, configured: false, status: 0, data: null, error: "Backend disabled" };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) headers.Cookie = `auth_token=${options.token}`;
  if (options.workspaceId) headers["X-Workspace-Id"] = options.workspaceId;

  try {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method: options.method ?? "POST",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message =
        (data && typeof data === "object" && (data.error || data.message)) ||
        `Backend responded ${response.status}`;
      return { ok: false, configured: true, status: response.status, data: null, error: String(message) };
    }

    return { ok: true, configured: true, status: response.status, data: data as T };
  } catch (error: any) {
    return {
      ok: false,
      configured: true,
      status: 0,
      data: null,
      error: error?.name === "TimeoutError" ? "Backend request timed out" : error?.message || "Backend unreachable",
    };
  }
}

/** Extract the auth_token cookie value emitted by a backend login/register call. */
export function tokenFromSetCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/auth_token=([^;]+)/);
  return match ? match[1] : null;
}

export async function backendLogin(email: string, password: string) {
  const result = await backendFetch<{ user: BackendUser }>("/api/auth/login", {
    body: { email, password },
  });
  return result;
}

/**
 * Same as backendLogin, but also returns the raw auth_token cookie value.
 * `backendFetch` parses JSON and drops headers, so the JWT needs its own call.
 */
export async function backendLoginWithToken(
  email: string,
  password: string,
): Promise<BackendResult<{ user: BackendUser; token: string | null }>> {
  if (!backendEnabled()) {
    return { ok: false, configured: false, status: 0, data: null, error: "Backend disabled" };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message =
        (data && typeof data === "object" && (data.error || data.message)) ||
        `Backend responded ${response.status}`;
      return { ok: false, configured: true, status: response.status, data: null, error: String(message) };
    }

    return {
      ok: true,
      configured: true,
      status: response.status,
      data: {
        user: data?.user as BackendUser,
        token: tokenFromSetCookie(response.headers.get("set-cookie")),
      },
    };
  } catch (error: any) {
    return {
      ok: false,
      configured: true,
      status: 0,
      data: null,
      error: error?.name === "TimeoutError" ? "Backend request timed out" : error?.message || "Backend unreachable",
    };
  }
}

export async function backendRegister(input: {
  email: string;
  password: string;
  name: string;
  workspaceName?: string;
  plan?: string;
}) {
  return backendFetch<{ user: BackendUser }>("/api/auth/register", { body: input });
}

/**
 * Register against the backend and capture the issued auth_token cookie.
 * Mirrors `backendLoginWithToken` — the JWT is only available on the raw
 * Set-Cookie header, which `backendFetch` discards.
 */
export async function backendRegisterWithToken(input: {
  email: string;
  password: string;
  name: string;
  brandName: string;
  category: string;
  website: string;
  market?: string;
  plan?: string;
}): Promise<BackendResult<{ user: BackendUser; token: string | null }>> {
  if (!backendEnabled()) {
    return { ok: false, configured: false, status: 0, data: null, error: "Backend disabled" };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message =
        (data && typeof data === "object" && (data.error || data.message)) ||
        `Backend responded ${response.status}`;
      return { ok: false, configured: true, status: response.status, data: null, error: String(message) };
    }

    return {
      ok: true,
      configured: true,
      status: response.status,
      data: {
        user: data?.user as BackendUser,
        token: tokenFromSetCookie(response.headers.get("set-cookie")),
      },
    };
  } catch (error: any) {
    return {
      ok: false,
      configured: true,
      status: 0,
      data: null,
      error: error?.name === "TimeoutError" ? "Backend request timed out" : error?.message || "Backend unreachable",
    };
  }
}

/**
 * Mint (or resume) a guest session on the backend and capture the issued
 * auth_token cookie. Used by the public free-scan flow, which needs a tenant
 * to run scans against before anyone has signed up.
 */
export async function backendGuestWithToken(body: { plan?: string } = {}) {
  if (!backendEnabled()) {
    return { ok: false, configured: false, status: 0, data: null, error: "Backend disabled" } as const;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/guest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message = (data && typeof data === "object" && (data.error || data.message)) || `Backend responded ${response.status}`;
      return { ok: false, configured: true, status: response.status, data: null, error: String(message) } as const;
    }

    return {
      ok: true,
      configured: true,
      status: response.status,
      data: {
        user: data?.user as BackendUser,
        token: tokenFromSetCookie(response.headers.get("set-cookie")),
      },
    } as const;
  } catch (error: any) {
    return {
      ok: false,
      configured: true,
      status: 0,
      data: null,
      error: error?.name === "TimeoutError" ? "Backend request timed out" : error?.message || "Backend unreachable",
    } as const;
  }
}

export async function backendMe(token: string) {
  return backendFetch<{ user: BackendUser }>("/api/auth/me", { method: "GET", token });
}
