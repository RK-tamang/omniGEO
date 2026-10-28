// Frontend auth session helpers
import { verifySessionToken as apiVerifySessionToken } from "@/lib/api-client";

export const SESSION_COOKIE = "answerscope_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14;
export type Session = { userId: string; email: string; name?: string; plan?: string; backendToken?: string; };

export const verifySessionToken = apiVerifySessionToken;

export function cookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.AUTH_COOKIE_SECURE === "true", path: "/", maxAge: SESSION_MAX_AGE };
}

export async function logAuthEvent() {}
