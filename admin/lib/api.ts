export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  }
  return searchParams.toString();
}

export async function getUsers(limit = 50, offset = 0) {
  return apiFetch(`/api/v1/admin/users?limit=${limit}&offset=${offset}`);
}

export async function updateUser(userId: string, body: Record<string, unknown>) {
  const search = qs(body as Record<string, string | number | boolean | undefined>);
  return apiFetch(`/api/v1/admin/users/${userId}?${search}`, { method: "PATCH" });
}

export async function getWorkspaces(limit = 50, offset = 0) {
  return apiFetch(`/api/v1/admin/workspaces?limit=${limit}&offset=${offset}`);
}

export async function updateWorkspace(workspaceId: string, body: Record<string, unknown>) {
  const search = qs(body as Record<string, string | number | boolean | undefined>);
  return apiFetch(`/api/v1/admin/workspaces/${workspaceId}?${search}`, { method: "PATCH" });
}

export async function getBilling() {
  return apiFetch("/api/v1/admin/billing");
}

export async function updateBilling(orgId: string, body: Record<string, unknown>) {
  const search = qs(body as Record<string, string | number | boolean | undefined>);
  return apiFetch(`/api/v1/admin/billing/${orgId}?${search}`, { method: "PATCH" });
}

export async function getProviders() {
  return apiFetch("/api/v1/admin/providers");
}

export async function updateProvider(providerId: string, body: Record<string, unknown>) {
  const search = qs(body as Record<string, string | number | boolean | undefined>);
  return apiFetch(`/api/v1/admin/providers/${providerId}?${search}`, { method: "PATCH" });
}

export async function getSettings() {
  return apiFetch("/api/v1/admin/settings");
}

export async function upsertSetting(body: { key: string; value: unknown }) {
  const search = qs({ key: body.key, value: String(body.value) });
  return apiFetch(`/api/v1/admin/settings?${search}`, { method: "POST" });
}
