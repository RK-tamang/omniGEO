import "dotenv/config";
import { db } from "./index.js";
import { users, workspaces, domains, prompts, settings } from "./schema.js";
import { hashPassword } from "../utils/auth.js";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

/** The prompts the demo workspace tracks — the ones the engine defaults to. */
const DEMO_PROMPTS = [
  { prompt: "What are the best testing alternatives?", type: "Category" as const },
  { prompt: "Top recommended tools like testing", type: "Category" as const },
  { prompt: "Is testing worth it? Reviews and pricing", type: "Question" as const },
  { prompt: "How does testing compare to competitors?", type: "Comparison" as const },
  { prompt: "Best solutions for teams considering testing", type: "Problem" as const },
];

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

      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId,
          email: "demo@omnigeo.ai",
          passwordHash,
          name: "Demo Explorer",
          plan: "Pro Growth",
          role: "owner",
          workspaceId,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });

        await tx.insert(workspaces).values({
          id: workspaceId,
          name: "Testing.com",
          ownerId: userId,
          plan: "Pro Growth",
          billingInterval: "monthly",
          billingCycleStart: now,
          settings: {
            whitelist: ["testing.com"],
            timezone: "Asia/Kolkata",
            locale: "en-IN",
            competitors: "",
            runDay: "Monday",
            digest: "Weekly",
            emailDigest: true,
            criticalAlerts: true,
            productUpdates: false,
          },
          createdAt: now,
          updatedAt: now,
        });

        await tx.insert(domains).values([
          { id: createId(), workspaceId, domain: "testing.com", isPrimary: true, createdAt: now, updatedAt: now },
        ]);

        await tx.insert(settings).values({
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
        });

        await tx.insert(prompts).values(
          DEMO_PROMPTS.map((p) => ({
            id: createId(),
            workspaceId,
            prompt: p.prompt,
            type: p.type,
            status: "active" as const,
            engines: {},
            sentiment: "Neutral" as const,
            createdAt: now,
            updatedAt: now,
          })),
        );
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