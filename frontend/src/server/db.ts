import "server-only";
// Tiny JSON-file persistence layer — the start of the real backend.
// Swap this module for Prisma/Postgres (or hand off to /backend) without touching callers.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

export const DEMO_EMAIL = "demo@omnigeo.ai";
export const DEMO_PASSWORD = "demo1234";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  plan: string;
  role: string;
  workspace: string;
};

type StoredUser = PublicUser & { passwordHash: string; salt: string };

export type ContactRequest = {
  receivedAt: string;
  intent: string;
  name: string;
  email: string;
  company: string;
  website?: string;
  teamSize?: string;
  budget?: string;
  message?: string;
};

type AuthEvent = { at: string; email: string; type: "login" | "logout" | "failed" };

export type Settings = {
  workspaceName: string;
  /**
   * Domains the workspace is allowed to scan / report on. The tools only ever
   * operate on entries in this list — nothing else is fetched or optimised.
   */
  whitelist: string[];
  timezone: string;
  locale: string;
  competitors: string;
  runDay: string;
  digest: string;
  emailDigest: boolean;
  criticalAlerts: boolean;
  productUpdates: boolean;
  // Billing fields
  plan?: string;
  billingInterval?: "monthly" | "yearly";
  billingCycleStart?: string;
  phone?: string;
};

export const DEFAULT_SETTINGS: Settings = {
  workspaceName: "Northwind Labs",
  whitelist: ["northwindlabs.com", "shop.northwindlabs.com"],
  timezone: "Asia/Kolkata",
  locale: "en-IN",
  competitors: "Competitor A, Competitor B, Competitor C",
  runDay: "Monday",
  digest: "Weekly",
  emailDigest: true,
  criticalAlerts: true,
  productUpdates: false,
};

/** Normalise a pasted domain or URL down to a bare hostname. */
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "");
}

/** A domain is valid if it looks like `example.com` / `sub.example.com`. */
export function isValidDomain(domain: string): boolean {
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(domain);
}

/** The primary (first) whitelisted domain — what the dashboard reports on. */
export function primaryDomain(settings: Settings): string {
  return settings.whitelist[0] ?? "northwindlabs.com";
}

type Db = {
  users: StoredUser[];
  contacts: ContactRequest[];
  events: AuthEvent[];
  settings?: Settings;
};

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 32).toString("hex");
}

function seed(): Db {
  const salt = randomBytes(16).toString("hex");
  return {
    users: [
      {
        id: "usr_demo",
        email: DEMO_EMAIL,
        name: "Aarav Mehta",
        plan: "Pro Growth",
        role: "Head of Growth",
        workspace: "Northwind Labs",
        salt,
        passwordHash: hashPassword(DEMO_PASSWORD, salt),
      },
    ],
    contacts: [],
    events: [],
  };
}

function persist(db: Db) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch {
    // Read-only filesystem (e.g. serverless) — degrade to in-memory behaviour.
  }
}

function load(): Db {
  if (!fs.existsSync(DB_FILE)) {
    const db = seed();
    persist(db);
    return db;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as Db;
  } catch {
    const db = seed();
    persist(db);
    return db;
  }
}

export function verifyCredentials(email: string, password: string): PublicUser | null {
  const db = load();
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return null;

  const derived = Buffer.from(hashPassword(password, user.salt), "hex");
  const stored = Buffer.from(user.passwordHash, "hex");
  if (derived.length !== stored.length || !timingSafeEqual(derived, stored)) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    role: user.role,
    workspace: user.workspace,
  };
}

export type RegisterResult =
  | { ok: true; user: PublicUser }
  | { ok: false; error: string; field?: "email" | "password" | "name" };

const NAME_MAX = 80;

/** Create an account. New accounts start on the free Starter plan. */
export function createUser(input: { name?: string; email: string; password: string }): RegisterResult {
  const email = input.email.trim().toLowerCase();
  const name = (input.name ?? "").trim().slice(0, NAME_MAX);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: "Enter a valid email address.", field: "email" };
  }
  if (input.password.length < 8) {
    return { ok: false, error: "Use at least 8 characters.", field: "password" };
  }
  if (!name) {
    return { ok: false, error: "Tell us what to call you.", field: "name" };
  }

  const db = load();
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    return { ok: false, error: "That email already has an account — sign in instead.", field: "email" };
  }

  const salt = randomBytes(16).toString("hex");
  const user: StoredUser = {
    id: `usr_${randomBytes(6).toString("hex")}`,
    email,
    name,
    plan: "Starter",
    role: "Owner",
    workspace: name.split(" ")[0] ? `${name.split(" ")[0]}'s workspace` : "My workspace",
    salt,
    passwordHash: hashPassword(input.password, salt),
  };

  db.users.push(user);
  db.events.push({ at: new Date().toISOString(), email, type: "login" });
  if (db.events.length > 500) db.events = db.events.slice(-500);
  persist(db);

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      role: user.role,
      workspace: user.workspace,
    },
  };
}

export function logAuthEvent(email: string, type: AuthEvent["type"]) {
  const db = load();
  db.events.push({ at: new Date().toISOString(), email, type });
  if (db.events.length > 500) db.events = db.events.slice(-500);
  persist(db);
}

export function saveContact(input: Omit<ContactRequest, "receivedAt">): ContactRequest {
  const db = load();
  const record: ContactRequest = { receivedAt: new Date().toISOString(), ...input };
  db.contacts.push(record);
  persist(db);
  return record;
}

export function getWorkspace() {
  const db = load();
  const user = db.users[0];
  if (!user) return null;
  return { name: user.workspace, plan: user.plan, member: user.name };
}

export function getSettings(): Settings {
  const db = load();
  const stored = (db.settings ?? {}) as Partial<Settings> & { domain?: string };

  // Build from the known keys only — a stray key from an older schema (the
  // legacy single `domain`) must never leak into the API response.
  const merged = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value = stored[key];
    if (value !== undefined) Object.assign(merged, { [key]: value });
  }

  // Migrate a legacy single-domain workspace into the whitelist shape.
  if (!Array.isArray(merged.whitelist) || merged.whitelist.length === 0) {
    const legacy = typeof stored.domain === "string" ? normalizeDomain(stored.domain) : "";
    merged.whitelist = legacy && isValidDomain(legacy) ? [legacy] : [...DEFAULT_SETTINGS.whitelist];
  }

  return merged;
}

/** Whitelisted update — unknown keys are ignored, types must match the default. */
export function saveSettings(input: Partial<Settings>): Settings {
  const db = load();
  const next: Settings = { ...DEFAULT_SETTINGS, ...(db.settings ?? {}) };

  const patch = input as Record<string, unknown>;
  const target = next as Record<string, unknown>;
  const defaults = DEFAULT_SETTINGS as Record<string, unknown>;

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const value = patch[key];
    if (value === undefined || value === null) continue;

    // The domain whitelist is the one array field: normalise, de-dupe, validate.
    if (key === "whitelist") {
      if (!Array.isArray(value)) continue;
      const seen = new Set<string>();
      const cleaned: string[] = [];
      for (const entry of value) {
        if (typeof entry !== "string") continue;
        const domain = normalizeDomain(entry);
        if (!isValidDomain(domain) || seen.has(domain)) continue;
        seen.add(domain);
        cleaned.push(domain);
      }
      // Never let the workspace end up with nothing to report on.
      if (cleaned.length > 0) target.whitelist = cleaned;
      continue;
    }

    if (typeof value !== typeof defaults[key]) continue;
    target[key] = typeof value === "string" ? value.trim().slice(0, 240) : value;
  }

  db.settings = next;
  persist(db);
  return next;
}

export function resetSettings(): Settings {
  const db = load();
  db.settings = { ...DEFAULT_SETTINGS };
  persist(db);
  return db.settings;
}
