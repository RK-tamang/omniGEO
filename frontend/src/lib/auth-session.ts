// Edge-safe session helpers: HMAC-signed cookie tokens (Web Crypto only, no Node APIs).
// Credential checks live in src/server/db.ts — keep server-only imports out of this file.

export const SESSION_COOKIE = "omni_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type Session = {
  email: string;
  name: string;
  plan: string;
  exp: number; // unix seconds
  /**
   * `auth_token` issued by the Fastify backend at login.
   * Present only when the backend login succeeded; lets Next route handlers
   * proxy authenticated requests without keeping a separate server-side store.
   * Signed into the cookie, so it is never readable/tamperable by the browser.
   */
  backendToken?: string;
  /** Backend user/workspace ids, used for tenants that predate the backend. */
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
