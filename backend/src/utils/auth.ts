import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): jwt.JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  } catch {
    return null;
  }
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const prefix = "ogk_";
  const randomPart = crypto.randomBytes(24).toString("base64url");
  const key = prefix + randomPart;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  return { key, prefix: prefix.slice(0, -1), hash };
}

export function verifyApiKey(key: string, hash: string): boolean {
  if (!key || !hash) return false;
  const computedHash = crypto.createHash("sha256").update(key).digest("hex");
  const a = Buffer.from(hash);
  const b = Buffer.from(computedHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyWebhookSignature(payload: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = generateWebhookSignature(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}