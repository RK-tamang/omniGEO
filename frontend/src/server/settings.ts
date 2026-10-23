import "server-only";
// Single resolver for workspace settings.
//
// Settings are written through `/api/settings`, which pushes to the backend
// whenever one is configured. Any *reader* must therefore read from the same
// place, or a page will show the local JSON store while the user's save went
// to the backend — the change then appears to be lost on reload.
//
// `resolveSettings` is the only supported way for a server component to read
// workspace settings.

import { backendEnabled, backendFetch } from "@/server/backend-client";
import { getSettings, type Settings } from "@/server/db";
import type { Session } from "@/lib/auth-session";
import {
  DEFAULT_DASHBOARD_LAYOUT,
  normalizeDashboardLayout,
  type DashboardLayout,
} from "@/lib/dashboard-layout";

export type BackendSettingsResponse = {
  workspace?: { name?: string };
  settings?: Partial<Settings>;
  domains?: Array<{ domain: string; isPrimary?: boolean }>;
};

/**
 * Convert the backend's `{ workspace, settings, domains }` payload into the
 * `Settings` shape the frontend pages already consume.
 */
export function fromBackend(payload: BackendSettingsResponse, base: Settings): Settings {
  const remote = payload.settings ?? {};
  const whitelist = payload.domains?.map((d) => d.domain).filter(Boolean);
  const merged: Settings = {
    ...base,
    ...remote,
    // `settings.workspaceName` is the value the workspace settings form
    // edits and the only one `PATCH /api/settings` persists, so it must win.
    // The workspace row's name is a separate field and is only a fallback.
    workspaceName: remote.workspaceName ?? payload.workspace?.name ?? base.workspaceName,
    whitelist: whitelist && whitelist.length > 0 ? whitelist : (remote.whitelist ?? base.whitelist),
  };
  // A layout read back from the backend may predate the current registry.
  merged.dashboardLayout = normalizeDashboardLayout(merged.dashboardLayout);
  return merged;
}

/**
 * The settings to render for this session.
 *
 * Falls back to the local JSON store when there is no backend, or when the
 * backend cannot be reached.
 */
export async function resolveSettings(session: Session | null): Promise<Settings> {
  const local = getSettings();

  if (session?.backendToken && backendEnabled()) {
    const result = await backendFetch<BackendSettingsResponse>("/api/settings", {
      method: "GET",
      token: session.backendToken,
    });
    if (result.ok && result.data) {
      return fromBackend(result.data, local);
    }
  }

  return local;
}

/** The dashboard layout to render for this session. */
export async function resolveDashboardLayout(session: Session | null): Promise<DashboardLayout> {
  const settings = await resolveSettings(session);
  return normalizeDashboardLayout(settings.dashboardLayout ?? DEFAULT_DASHBOARD_LAYOUT);
}
