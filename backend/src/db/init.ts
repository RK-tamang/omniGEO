import "dotenv/config";
import { db } from "./index.js";
import { users, workspaces, domains, settings } from "./schema.js";
import { hashPassword } from "../utils/auth.js";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

async function initDatabase() {
  console.log("Initializing database...");

  try {
    const existingUser = await db.select().from(users).where(eq(users.email, "demo@omnigeo.ai")).limit(1);

    if (existingUser.length === 0) {
      console.log("Creating demo user and workspace...");

      const userId = createId();
      const workspaceId = createId();
      const passwordHash = await hashPassword("demo1234");
      const now = new Date();

      // Hash first, then run synchronous inserts inside a sync transaction
      // (better-sqlite3 transactions cannot be async).
      db.transaction((tx) => {
        tx.insert(users).values({
          id: userId,
          email: "demo@omnigeo.ai",
          passwordHash,
          name: "Aarav Mehta",
          plan: "Pro Growth",
          role: "owner",
          workspaceId,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }).run();

        tx.insert(workspaces).values({
          id: workspaceId,
          name: "Northwind Labs",
          ownerId: userId,
          plan: "Pro Growth",
          billingInterval: "monthly",
          billingCycleStart: now,
          settings: {
            whitelist: ["northwindlabs.com", "shop.northwindlabs.com"],
            timezone: "Asia/Kolkata",
            locale: "en-IN",
            competitors: "Competitor A, Competitor B, Competitor C",
            runDay: "Monday",
            digest: "Weekly",
            emailDigest: true,
            criticalAlerts: true,
            productUpdates: false,
          },
          createdAt: now,
          updatedAt: now,
        }).run();

        tx.insert(domains).values([
          { id: createId(), workspaceId, domain: "northwindlabs.com", isPrimary: true, createdAt: now, updatedAt: now },
          { id: createId(), workspaceId, domain: "shop.northwindlabs.com", isPrimary: false, createdAt: now, updatedAt: now },
        ]).run();

        tx.insert(settings).values({
          id: createId(),
          workspaceId,
          key: "notifications",
          value: {
            emailDigest: true,
            criticalAlerts: true,
            productUpdates: false,
            slackWebhook: "",
            slackChannel: "",
          },
          updatedAt: now,
        }).run();
      });

      console.log("Demo user created: demo@omnigeo.ai / demo1234");
    } else {
      console.log("Demo user already exists");
    }

    console.log("Database initialization complete!");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}

initDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));