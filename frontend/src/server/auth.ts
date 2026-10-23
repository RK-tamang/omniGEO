import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { resolveSettings } from "./settings";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  plan: string;
  workspaceId: string;
  role: string;
  profile?: {
    phone?: string;
  };
}

/**
 * Resolve the signed-in user from the HMAC-signed session cookie.
 *
 * The session cookie is `base64url(json).hmac`, so it must be verified with
 * `verifySessionToken` — decoding it as raw base64 JSON silently fails and
 * makes every authenticated route return 401.
 */
export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (!session) return null;

    // Workspace settings supply the display plan/name for legacy local users.
    const settings = await resolveSettings(session);

    return {
      id: session.userId ?? session.email,
      email: session.email,
      name: session.name,
      plan: session.plan || settings.plan || "Starter",
      workspaceId: session.workspaceId ?? settings.workspaceName ?? "default",
      role: "owner",
      profile: { phone: settings.phone },
    };
  } catch {
    return null;
  }
}

export async function requireAuth(request: Request): Promise<AuthUser> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
