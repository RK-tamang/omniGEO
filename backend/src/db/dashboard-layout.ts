/**
 * Canonical registry of dashboard blocks and layout presets.
 *
 * The dashboard home page is assembled from blocks rather than being a fixed
 * page. Which blocks appear, and in what order, is a per-workspace setting —
 * see `DashboardLayout` below. This module is the single source of truth for
 * the *valid* block ids, so the API can reject garbage instead of storing it.
 *
 * The frontend keeps a mirrored copy (`frontend/src/lib/dashboard-layout.ts`)
 * so the app still works with no backend running. The two lists are
 * intentionally small and stable; the API returns its own copy so the client
 * can detect drift.
 */

export const DASHBOARD_BLOCK_GROUPS = [
  { id: "visibility", label: "AI Search Visibility" },
  { id: "audit", label: "GEO Website Audit" },
  { id: "competitor", label: "Competitor Intelligence" },
  { id: "content", label: "AI Content Optimization" },
  { id: "monitoring", label: "Monitoring & Reporting" },
] as const;

export type DashboardBlockGroup = (typeof DASHBOARD_BLOCK_GROUPS)[number]["id"];

export type DashboardBlock = {
  id: string;
  label: string;
  group: DashboardBlockGroup;
  description: string;
};

export const DASHBOARD_BLOCKS: DashboardBlock[] = [
  {
    id: "kpis",
    label: "Headline KPIs",
    group: "visibility",
    description: "Visibility score, tracked prompts, citations won and competitors tracked.",
  },
  {
    id: "trend",
    label: "Mention rate trend",
    group: "visibility",
    description: "Mention rate across all four engines over the last 30 days.",
  },
  {
    id: "sov",
    label: "Share of voice",
    group: "visibility",
    description: "How much of the first page you own against tracked competitors.",
  },
  {
    id: "prompt-coverage",
    label: "Prompt coverage",
    group: "visibility",
    description: "Cited, mentioned and missing across every tracked prompt.",
  },
  {
    id: "audit-score",
    label: "Site health score",
    group: "audit",
    description: "Overall audit score with the per-category breakdown.",
  },
  {
    id: "audit-issues",
    label: "Open audit issues",
    group: "audit",
    description: "Issues grouped by severity, with the fix for each one.",
  },
  {
    id: "crawler-access",
    label: "AI crawler access",
    group: "audit",
    description: "Which answer engines are allowed to read your pages.",
  },
  {
    id: "competitor-compare",
    label: "Competitor comparison",
    group: "competitor",
    description: "Share of voice, mention rate and citation reach per brand.",
  },
  {
    id: "content-gaps",
    label: "Content gaps",
    group: "competitor",
    description: "The topics competitors own that you do not.",
  },
  {
    id: "content-pipeline",
    label: "Content pipeline",
    group: "content",
    description: "Drafts, reviews and published pieces with their scores.",
  },
  {
    id: "opportunities",
    label: "Top opportunities",
    group: "content",
    description: "The highest-impact fixes, ranked by impact and effort.",
  },
  {
    id: "alerts",
    label: "Open alerts",
    group: "monitoring",
    description: "Mention, citation and competitor alerts that need a decision.",
  },
  {
    id: "schedule",
    label: "Scheduled checks",
    group: "monitoring",
    description: "What runs next, and when.",
  },
  {
    id: "activity",
    label: "Recent activity",
    group: "monitoring",
    description: "Scans, optimizations and alerts from the last few days.",
  },
  {
    id: "tool-categories",
    label: "Tool categories",
    group: "monitoring",
    description: "Shortcuts into every tool group in the dashboard.",
  },
];

export const DASHBOARD_BLOCK_IDS = DASHBOARD_BLOCKS.map((b) => b.id);

export type DashboardPreset = {
  id: string;
  name: string;
  blurb: string;
  blocks: string[];
};

export const DASHBOARD_PRESETS: DashboardPreset[] = [
  {
    id: "executive",
    name: "Executive",
    blurb: "The few numbers a leadership conversation actually needs.",
    blocks: ["kpis", "trend", "activity"],
  },
  {
    id: "growth",
    name: "Growth",
    blurb: "Where you are losing share of voice, and what to fix this week.",
    blocks: ["kpis", "sov", "opportunities", "alerts"],
  },
  {
    id: "seo",
    name: "SEO & Technical",
    blurb: "Crawlability, schema and the issues blocking citations.",
    blocks: ["audit-score", "audit-issues", "crawler-access", "opportunities"],
  },
  {
    id: "competitor",
    name: "Competitive watch",
    blurb: "What competitors are winning, and the gaps they leave open.",
    blocks: ["competitor-compare", "content-gaps", "sov", "alerts"],
  },
  {
    id: "content",
    name: "Content",
    blurb: "The pipeline, the scores, and the drafts worth picking up.",
    blocks: ["content-pipeline", "opportunities", "kpis", "activity"],
  },
  {
    id: "monitoring",
    name: "Monitoring",
    blurb: "Alerts, scheduled runs and everything that moved recently.",
    blocks: ["alerts", "schedule", "activity", "kpis"],
  },
];

export const DEFAULT_PRESET_ID = "executive";

/**
 * Reserved label for a layout the user assembled by hand. It is not a preset
 * (it has no entry in `DASHBOARD_PRESETS`), but the normaliser keeps it so the
 * UI can say "Custom view" instead of naming a preset the blocks don't match.
 */
export const CUSTOM_PRESET_ID = "custom";

export type DashboardLayout = {
  preset: string;
  /** Ordered ids of the blocks to show. Unknown ids are dropped. */
  blocks: string[];
};

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  preset: DEFAULT_PRESET_ID,
  blocks: [...DASHBOARD_PRESETS[0].blocks],
};

const KNOWN = new Set(DASHBOARD_BLOCK_IDS);
const KNOWN_PRESETS = new Set(DASHBOARD_PRESETS.map((p) => p.id));

/**
 * Coerce anything into a valid layout.
 *
 * Unknown block ids are dropped, duplicates are removed, and an empty result
 * falls back to the default preset. This is the only place a layout is
 * accepted from a client, so it is deliberately forgiving — a bad id should
 * never be able to break the dashboard.
 */
export function normalizeDashboardLayout(input: unknown): DashboardLayout {
  const raw = (input ?? {}) as Partial<DashboardLayout>;
  const preset =
    raw.preset === CUSTOM_PRESET_ID
      ? CUSTOM_PRESET_ID
      : typeof raw.preset === "string" && KNOWN_PRESETS.has(raw.preset)
        ? raw.preset
        : DEFAULT_PRESET_ID;

  const seen = new Set<string>();
  const blocks: string[] = [];
  if (Array.isArray(raw.blocks)) {
    for (const id of raw.blocks) {
      if (typeof id !== "string" || !KNOWN.has(id) || seen.has(id)) continue;
      seen.add(id);
      blocks.push(id);
    }
  }

  if (blocks.length === 0) {
    return { preset, blocks: [...(DASHBOARD_PRESETS.find((p) => p.id === preset)?.blocks ?? DEFAULT_DASHBOARD_LAYOUT.blocks)] };
  }
  return { preset, blocks };
}

/** The preset's block list, always valid. */
export function presetBlocks(presetId: string): string[] {
  const preset = DASHBOARD_PRESETS.find((p) => p.id === presetId);
  return preset ? [...preset.blocks] : [...DEFAULT_DASHBOARD_LAYOUT.blocks];
}
