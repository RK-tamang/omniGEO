import type { WorkspaceData } from "@/hooks/use-workspace-data";
import {
  ENGINE_COLORS,
  ENGINE_KEYS,
  ENGINE_LABELS,
  type ContentItem,
  type EngineKey,
  type PromptRow,
  type Series,
} from "@/lib/dashboard-config";

/**
 * Live workspace data, shaped for the dashboard.
 *
 * Every helper here derives from rows the backend actually holds. A workspace
 * with no prompts, no scans and no issues yields empty collections and zeroed
 * figures, so the UI can render an honest empty state instead of a
 * placeholder number.
 */

const ENGINE_STATUSES = new Set(["cited", "mentioned", "missing"]);

const PROMPT_TYPES = ["Category", "Comparison", "Problem", "Brand", "Question", "How-to"] as const;
const SENTIMENTS = ["Positive", "Neutral", "Risk"] as const;
const SEVERITIES = ["Critical", "Warning", "Notice"] as const;

/** Audit checks the engine runs, grouped into the categories we report on. */
const CHECK_CATEGORIES: { category: string; names: string[] }[] = [
  { category: "Infrastructure", names: ["HTTPS", "robots.txt", "sitemap.xml", "llms.txt"] },
  {
    category: "On-page",
    names: [
      "Title tag",
      "Meta description",
      "H1 heading",
      "Canonical",
      "Open Graph tags",
      "HTML lang attribute",
      "Content depth",
    ],
  },
  { category: "Structured data", names: ["Structured data (JSON-LD)"] },
  { category: "AI readiness", names: ["Question-form headings", "List formatting"] },
];

export type Kpi = {
  label: string;
  value: string;
  delta: number;
  unit: string;
  hint: string;
  spark?: number[];
  color?: string;
};

export type AuditIssue = {
  severity: (typeof SEVERITIES)[number];
  title: string;
  pages: number;
  detail: string;
  fix: string;
};

export type AuditSummary = {
  score: number;
  checks: number;
  passed: number;
  warned: number;
  failed: number;
  categories: { name: string; score: number }[];
  issues: AuditIssue[];
  ranAt: string | null;
};

export type ActivityRow = { tone: "win" | "info" | "alert"; text: string; time: string };

export type VisibilityPoint = {
  at: number;
  score: number;
  engines: Record<string, number>;
};

/* --------------------------------- primitives -------------------------------- */

function toMillis(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toEngineStatus(value: unknown): "cited" | "mentioned" | "missing" {
  return typeof value === "string" && ENGINE_STATUSES.has(value)
    ? (value as "cited" | "mentioned" | "missing")
    : "missing";
}

function relativeTime(value: string | number | null | undefined): string {
  const at = toMillis(value);
  if (at === null) return "recently";
  const diff = Date.now() - at;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} h ago`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)} d ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function dayLabel(at: number): string {
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* ---------------------------------- prompts --------------------------------- */

export function mergePrompts(data: WorkspaceData | null): PromptRow[] {
  const live = data?.prompts ?? [];
  return live.map((p) => {
    const engines: Record<EngineKey, "cited" | "mentioned" | "missing"> = {
      chatgpt: toEngineStatus(p.engines?.chatgpt),
      perplexity: toEngineStatus(p.engines?.perplexity),
      gemini: toEngineStatus(p.engines?.gemini),
      aio: toEngineStatus(p.engines?.aio),
    };
    return {
      prompt: p.prompt,
      type: (PROMPT_TYPES as readonly string[]).includes(p.type)
        ? (p.type as PromptRow["type"])
        : "Question",
      engines,
      sentiment: p.sentiment === "Negative" ? "Risk" : (SENTIMENTS as readonly string[]).includes(p.sentiment ?? "")
        ? (p.sentiment as PromptRow["sentiment"])
        : "Neutral",
    };
  });
}

/** Mention rate per engine, computed from the live prompt rows. */
export function mergeEngineMentionRate(data: WorkspaceData | null): { key: EngineKey; value: number; change: number }[] {
  const rows = mergePrompts(data);
  if (rows.length === 0) return [];

  return ENGINE_KEYS.map((key) => {
    let cited = 0;
    let mentioned = 0;
    for (const row of rows) {
      const status = row.engines[key];
      if (status === "cited") cited++;
      else if (status === "mentioned") mentioned++;
    }
    const value = Math.round(((cited + mentioned * 0.4) / rows.length) * 1000) / 10;
    return { key, value, change: 0 };
  });
}

/* --------------------------------- visibility -------------------------------- */

/** Completed visibility scans, oldest first. */
export function visibilityPoints(data: WorkspaceData | null): VisibilityPoint[] {
  const scans = data?.scans ?? [];
  return scans
    .filter((s) => s.type === "visibility" && s.status === "completed")
    .map((s) => {
      const at = toMillis(s.createdAt) ?? 0;
      const engines: Record<string, number> = {};
      for (const e of (s.result?.engines ?? []) as Array<{ engine?: string; score?: number }>) {
        if (typeof e?.engine === "string" && typeof e?.score === "number") engines[e.engine] = e.score;
      }
      const score =
        typeof s.result?.overallVisibilityScore === "number"
          ? s.result.overallVisibilityScore
          : typeof s.score === "number"
            ? s.score
            : 0;
      return { at, score, engines };
    })
    .sort((a, b) => a.at - b.at);
}

/** Visibility trend series, built from the workspace's own visibility scans. */
export function mergeVisibilityTrend(data: WorkspaceData | null): { series: Series[]; labels: string[] } {
  const points = visibilityPoints(data);
  if (points.length === 0) return { series: [], labels: [] };

  const labels = points.map((p) => dayLabel(p.at));
  const series: Series[] = ENGINE_KEYS.map((key) => ({
    name: ENGINE_LABELS[key],
    color: ENGINE_COLORS[key],
    data: points.map((p) => p.engines[key] ?? 0),
  })).filter((s) => s.data.some((v) => v > 0));

  if (series.length === 0) {
    series.push({ name: "Visibility score", color: ENGINE_COLORS.chatgpt, data: points.map((p) => p.score) });
  }

  return { series, labels };
}

/* ---------------------------------- content --------------------------------- */

const CONTENT_STATUS: Record<string, ContentItem["status"]> = {
  published: "Published",
  in_review: "In review",
  review: "In review",
  draft: "Draft",
  archived: "Draft",
};

export function mergeContentItems(data: WorkspaceData | null): ContentItem[] {
  const live = data?.contentItems ?? [];
  return live.map((c) => ({
    title: c.title,
    status: CONTENT_STATUS[c.status] ?? "Draft",
    score: c.score ?? 0,
    target: c.targetPrompt ?? "",
    words: c.wordCount ?? 0,
    updated: relativeTime(c.updatedAt),
  }));
}

export function mergeContentKpis(data: WorkspaceData | null): Kpi[] {
  const items = mergeContentItems(data);
  if (items.length === 0) {
    return [
      { label: "Avg content score", value: "—", delta: 0, unit: "pts", hint: "No content tracked yet" },
      { label: "Published", value: "0", delta: 0, unit: "pieces", hint: "Nothing published yet" },
      { label: "In review", value: "0", delta: 0, unit: "pieces", hint: "Nothing awaiting approval" },
      { label: "Citation-ready", value: "0/0", delta: 0, unit: "", hint: "Score 80+ with sources" },
    ];
  }

  const avg = Math.round(items.reduce((s, c) => s + c.score, 0) / items.length);
  const published = items.filter((c) => c.status === "Published").length;
  const inReview = items.filter((c) => c.status === "In review").length;
  const ready = items.filter((c) => c.score >= 80).length;

  return [
    { label: "Avg content score", value: `${avg}`, delta: 0, unit: "pts", hint: `Across ${items.length} tracked pieces` },
    { label: "Published", value: `${published}`, delta: 0, unit: "pieces", hint: "Live in your workspace" },
    { label: "In review", value: `${inReview}`, delta: 0, unit: "pieces", hint: "Awaiting your approval" },
    { label: "Citation-ready", value: `${ready}/${items.length}`, delta: 0, unit: "", hint: "Score 80+ with sources" },
  ];
}

/* ----------------------------------- audit ---------------------------------- */

/** The most recent completed audit scan. */
function latestAuditScan(data: WorkspaceData | null) {
  const scans = (data?.scans ?? []).filter((s) => s.type === "audit" && s.status === "completed");
  return scans.sort(
    (a, b) => (toMillis(b.createdAt) ?? 0) - (toMillis(a.createdAt) ?? 0),
  )[0];
}

export function mergeAudit(data: WorkspaceData | null): AuditSummary {
  const scan = latestAuditScan(data);
  const checks = scan?.checks ?? [];
  const passed = checks.filter((c) => c.status === "pass").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  const failed = checks.filter((c) => c.status === "fail").length;

  const categories = CHECK_CATEGORIES.map(({ category, names }) => {
    const group = checks.filter((c) => names.includes(c.name));
    const groupPassed = group.filter((c) => c.status === "pass").length;
    return {
      name: category,
      score: group.length > 0 ? Math.round((groupPassed / group.length) * 100) : 0,
    };
  }).filter((c) => checks.some((check) => CHECK_CATEGORIES.find((g) => g.category === c.name)?.names.includes(check.name)));

  const issues: AuditIssue[] = (data?.auditIssues ?? []).map((i) => ({
    severity: (SEVERITIES as readonly string[]).includes(i.severity)
      ? (i.severity as AuditIssue["severity"])
      : "Notice",
    title: i.title,
    pages: i.pagesAffected ?? 0,
    detail: i.description,
    fix: i.fix,
  }));

  const score =
    typeof scan?.score === "number"
      ? scan.score
      : checks.length > 0
        ? Math.round((passed / checks.length) * 100)
        : 0;

  return {
    score,
    checks: checks.length,
    passed,
    warned,
    failed,
    categories,
    issues,
    ranAt: scan ? relativeTime(scan.createdAt) : null,
  };
}

/* -------------------------------- competitors -------------------------------- */

/** Share of voice, from the live competitor rows. */
export function mergeShareOfVoice(data: WorkspaceData | null): { name: string; value: number; you: boolean }[] {
  const live = data?.competitors ?? [];
  if (live.length === 0) return [];

  const own = data?.workspace?.name ?? "Your brand";
  const rows = mergePrompts(data);
  const seen = rows.filter((r) => Object.values(r.engines).some((s) => s !== "missing")).length;
  const ownShare = rows.length ? Math.round((seen / rows.length) * 100) : 0;

  const out = live.map((c) => ({ name: c.name, value: c.visibilityScore ?? 0, you: false }));
  out.unshift({ name: `${own} (you)`, value: ownShare, you: true });
  return out;
}

export type CompetitorMatrix = {
  brands: { name: string; you: boolean }[];
  rows: { prompt: string; statuses: ("wins" | "second" | "absent")[] }[];
};

/**
 * Who wins each prompt. "You" comes from the workspace's own prompt rows;
 * rivals come from the per-competitor prompt statuses the engine records.
 */
export function mergeCompetitorMatrix(data: WorkspaceData | null): CompetitorMatrix {
  const prompts = mergePrompts(data);
  const competitors = data?.competitors ?? [];
  const competitorPrompts = data?.competitorPrompts ?? [];

  const brands = [
    { name: data?.workspace?.name ?? "Your brand", you: true },
    ...competitors.map((c) => ({ name: c.name, you: false })),
  ];

  const promptIds = new Map((data?.prompts ?? []).map((p) => [p.prompt, p.id]));

  const rows = prompts.map((p) => {
    const promptId = promptIds.get(p.prompt);
    const ownStatus = strongest(Object.values(p.engines));

    const statuses = competitors.map((competitor) => {
      const rivalRows = competitorPrompts.filter(
        (cp) => cp.competitorId === competitor.id && (!promptId || cp.promptId === promptId),
      );
      return strongest(rivalRows.map((cp) => toEngineStatus(cp.status)));
    });

    return {
      prompt: p.prompt,
      statuses: [ownStatus, ...statuses] as ("wins" | "second" | "absent")[],
    };
  });

  return { brands, rows };
}

function strongest(statuses: string[]): "wins" | "second" | "absent" {
  if (statuses.includes("cited")) return "wins";
  if (statuses.includes("mentioned")) return "second";
  return "absent";
}

/* --------------------------------- headline --------------------------------- */

export function mergeOverviewKpis(data: WorkspaceData | null): Kpi[] {
  const points = visibilityPoints(data);
  const rows = mergePrompts(data);
  const latest = points[points.length - 1];
  const previous = points[points.length - 2];
  const delta = latest && previous ? latest.score - previous.score : 0;

  return [
    {
      label: "Visibility score",
      value: latest ? `${latest.score}` : "—",
      delta,
      unit: "pts",
      hint: latest ? "From your latest visibility scan" : "Run a visibility scan to populate this",
      spark: points.length > 1 ? points.map((p) => p.score) : undefined,
      color: ENGINE_COLORS.chatgpt,
    },
    {
      label: "Prompts tracked",
      value: `${rows.length}`,
      delta: 0,
      unit: "tracked",
      hint: rows.length > 0 ? "In this workspace" : "Add prompts to start tracking",
      color: ENGINE_COLORS.perplexity,
    },
    {
      label: "Citations won",
      value: `${data?.citations?.length ?? 0}`,
      delta: 0,
      unit: "cites",
      hint: "Pages cited by AI engines",
      color: ENGINE_COLORS.gemini,
    },
    {
      label: "Competitors tracked",
      value: `${data?.competitors?.length ?? 0}`,
      delta: 0,
      unit: "comps",
      hint: "Brands you are compared against",
      color: ENGINE_COLORS.aio,
    },
  ];
}

/* ------------------------------- opportunities ------------------------------ */

/** Opportunities derived from live prompts that are not yet cited. */
export function mergeOpportunities(data: WorkspaceData | null): { prompt: string; gap: string; effort: string; impact: string }[] {
  const rows = mergePrompts(data);
  return rows
    .filter((r) => !Object.values(r.engines).includes("cited"))
    .slice(0, 6)
    .map((r) => {
      const statuses = Object.values(r.engines);
      const gap = statuses.every((s) => s === "missing")
        ? "Not cited in any engine"
        : "Mentioned, never cited";
      const effort = statuses.filter((s) => s === "missing").length > 1 ? "High" : "Medium";
      return { prompt: r.prompt, gap, effort, impact: "High" };
    });
}

/** Content gaps, from live competitors. */
export function mergeContentGaps(data: WorkspaceData | null): { gap: string; detail: string; impact: string }[] {
  const live = data?.competitors ?? [];
  if (live.length === 0) return [];

  const ownCitations = data?.citations?.length ?? 0;
  return live
    .filter((c) => (c.citationsCount ?? 0) > ownCitations)
    .slice(0, 4)
    .map((c) => ({
      gap: `${c.name} is cited more often`,
      detail: `${c.name} holds ${c.citationsCount ?? 0} citation domains against your ${ownCitations}.`,
      impact: (c.visibilityScore ?? 0) >= 20 ? "High" : "Medium",
    }));
}

/* --------------------------------- activity --------------------------------- */

/** Recent workspace events, newest first. */
export function mergeActivity(data: WorkspaceData | null): ActivityRow[] {
  const rows: { at: number; tone: ActivityRow["tone"]; text: string }[] = [];

  for (const alert of data?.alerts ?? []) {
    rows.push({
      at: toMillis(alert.createdAt) ?? 0,
      tone: alert.severity === "Critical" ? "alert" : "info",
      text: alert.title,
    });
  }

  for (const scan of data?.scans ?? []) {
    const label = scan.type.charAt(0).toUpperCase() + scan.type.slice(1);
    rows.push({
      at: toMillis(scan.createdAt) ?? 0,
      tone: scan.status === "failed" ? "alert" : "win",
      text:
        scan.status === "completed"
          ? `${label} scan completed${typeof scan.score === "number" ? ` — score ${scan.score}` : ""}`
          : `${label} scan ${scan.status}`,
    });
  }

  for (const report of data?.reports ?? []) {
    rows.push({
      at: toMillis(report.createdAt) ?? 0,
      tone: "info",
      text: `Report “${report.name}” ${report.status}`,
    });
  }

  return rows
    .sort((a, b) => b.at - a.at)
    .slice(0, 8)
    .map((r) => ({ ...r, time: relativeTime(r.at) }));
}

/* --------------------------------- citations -------------------------------- */

export type CitationRow = {
  id: string;
  prompt: string;
  engine: string;
  domain: string;
  url: string;
  title: string;
  position: number | null;
  when: string;
};

/** Citations the engines recorded, joined back to the prompt that won them. */
export function mergeCitations(data: WorkspaceData | null): CitationRow[] {
  const prompts = new Map((data?.prompts ?? []).map((p) => [p.id, p.prompt]));

  return (data?.citations ?? [])
    .slice()
    .sort((a, b) => (toMillis(b.capturedAt) ?? 0) - (toMillis(a.capturedAt) ?? 0))
    .map((c) => ({
      id: c.id,
      prompt: c.promptId ? (prompts.get(c.promptId) ?? "—") : "—",
      engine: c.engine,
      domain: c.domain,
      url: c.url,
      title: c.title ?? "",
      position: c.position ?? null,
      when: relativeTime(c.capturedAt),
    }));
}

/* -------------------------------- competitors ------------------------------- */

export type CompetitorRow = {
  id: string;
  name: string;
  domain: string;
  visibility: number;
  citations: number;
  prompts: number;
  lastChecked: string;
};

/** The brands this workspace is compared against. */
export function mergeCompetitors(data: WorkspaceData | null): CompetitorRow[] {
  const promptIds = new Map((data?.prompts ?? []).map((p) => [p.id, p.prompt]));
  const competitorPrompts = data?.competitorPrompts ?? [];

  return (data?.competitors ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    domain: c.domain ?? "",
    visibility: c.visibilityScore ?? 0,
    citations: c.citationsCount ?? 0,
    prompts:
      c.promptsWon ??
      new Set(
        competitorPrompts
          .filter((cp) => cp.competitorId === c.id && cp.status === "cited")
          .map((cp) => promptIds.get(cp.promptId) ?? cp.promptId),
      ).size,
    lastChecked: relativeTime(c.lastCheckedAt),
  }));
}

/* ------------------------------ brand mentions ----------------------------- */

export type MentionRow = {
  id: string;
  prompt: string;
  engine: string;
  status: "cited" | "mentioned";
  sentiment: string;
  when: string;
};

/** Every engine mention of the brand, one row per prompt and engine. */
export function mergeBrandMentions(data: WorkspaceData | null): MentionRow[] {
  const rows: MentionRow[] = [];

  for (const p of data?.prompts ?? []) {
    for (const engine of ENGINE_KEYS) {
      const status = toEngineStatus(p.engines?.[engine]);
      if (status === "missing") continue;
      rows.push({
        id: `${p.id}-${engine}`,
        prompt: p.prompt,
        engine: ENGINE_LABELS[engine],
        status,
        sentiment: p.sentiment ?? "Neutral",
        when: relativeTime(p.updatedAt),
      });
    }
  }

  return rows.sort((a, b) => a.engine.localeCompare(b.engine));
}
