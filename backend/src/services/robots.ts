/**
 * robots.txt parsing for AI crawler access.
 *
 * Answer engines announce themselves with a user-agent string and are governed
 * by the same robots.txt rules as everyone else. This module reads a real
 * robots.txt body and reports, per known bot, whether that bot can reach the
 * site root — the difference between being cited and being invisible.
 */

export type BotAccessStatus = "allowed" | "blocked" | "limited";

export type BotAccess = {
  bot: string;
  owner: string;
  purpose: string;
  status: BotAccessStatus;
  rule: string | null;
};

/** The answer-engine crawlers we report on. */
export const AI_BOTS: { bot: string; owner: string; purpose: string }[] = [
  { bot: "GPTBot", owner: "OpenAI", purpose: "Model training" },
  { bot: "OAI-SearchBot", owner: "OpenAI", purpose: "ChatGPT search results" },
  { bot: "PerplexityBot", owner: "Perplexity", purpose: "Perplexity answers" },
  { bot: "ClaudeBot", owner: "Anthropic", purpose: "Model training" },
  { bot: "Google-Extended", owner: "Google", purpose: "Gemini grounding" },
  { bot: "Bingbot", owner: "Microsoft", purpose: "Bing + Copilot" },
];

type Rule = { allow: boolean; path: string };

type Group = { agents: string[]; rules: Rule[] };

/** Split a robots.txt body into user-agent groups. */
export function parseRobotsGroups(body: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let expectingAgents = false;

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!current || !expectingAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
        expectingAgents = true;
      }
      if (value) current.agents.push(value.toLowerCase());
      continue;
    }

    if (!current) continue;
    expectingAgents = false;

    if (field === "allow" || field === "disallow") {
      // "Disallow:" with an empty value means allow everything.
      if (field === "disallow" && value === "") continue;
      current.rules.push({ allow: field === "allow", path: value });
    }
  }

  return groups;
}

/** Does a robots path pattern match the site root? */
function matchesRoot(pattern: string): boolean {
  if (pattern === "" || pattern === "/") return true;
  // Only patterns that cover the root matter for "can this bot read the site".
  // A pattern like /pricing does not block "/", and /path$ style anchors do
  // not either.
  return pattern === "*" || /^\/\*$/.test(pattern);
}

/** Longest-match resolution for the root path, per the robots.txt spec. */
function rootVerdict(rules: Rule[]): { blocked: boolean; rule: string | null } {
  let best: { length: number; allow: boolean; path: string } | null = null;

  for (const rule of rules) {
    if (!matchesRoot(rule.path)) continue;
    const length = rule.path.length;
    if (!best || length > best.length || (length === best.length && rule.allow && !best.allow)) {
      best = { length, allow: rule.allow, path: rule.path };
    }
  }

  if (!best) return { blocked: false, rule: null };
  return { blocked: !best.allow, rule: `${best.allow ? "Allow" : "Disallow"}: ${best.path}` };
}

/**
 * Report per-bot access for a robots.txt body.
 *
 * Only the most specific matching group applies to a bot: its own group when
 * one exists, otherwise the wildcard group.
 */
export function parseBotAccess(body: string, bots = AI_BOTS): BotAccess[] {
  const groups = parseRobotsGroups(body);
  const wildcard = groups.find((g) => g.agents.includes("*"));

  return bots.map((bot) => {
    const key = bot.bot.toLowerCase();
    const specific = groups.find((g) => g.agents.includes(key));
    const group = specific ?? wildcard;

    if (!group) {
      return { ...bot, status: "allowed" as const, rule: null };
    }

    const { blocked, rule } = rootVerdict(group.rules);
    if (blocked) {
      return { ...bot, status: "blocked" as const, rule };
    }

    // Allowed at the root, but the group still withholds some paths.
    const limited = group.rules.some((r) => !r.allow);
    return { ...bot, status: limited ? ("limited" as const) : ("allowed" as const), rule };
  });
}
