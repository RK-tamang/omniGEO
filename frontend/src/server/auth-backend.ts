import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { getAuthUser, type AuthUser } from "./auth";

/**
 * Resolve the current user plus the backend auth_token held inside the signed
 * session cookie. Route handlers use this to proxy calls to the Fastify backend
 * as the same tenant the browser is logged in as.
 */
export async function getAuthUserWithBackendToken(
  request?: Request,
): Promise<{ user: AuthUser | null; backendToken: string | null }> {
  const user = await getAuthUser(request as Request);
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  return { user, backendToken: session?.backendToken ?? null };
}
