# Dashboard

The OmniGEO dashboard home is not a fixed page — it is assembled from a set of
**blocks**, in an order the workspace chooses. This document is the working
reference for changing any part of that: the block registry, the presets, the
customiser, the sub-dashboard demos, and how data reaches the screen.

If you are an agent picking up dashboard work, read
[Guardrails](#guardrails) before editing, and use
[Adding a block](#adding-a-block) as the checklist.

---

## 1. Route map

| Route | File | What it is |
| --- | --- | --- |
| `/dashboard` | `frontend/src/app/dashboard/page.tsx` | The assembled home. Server component; resolves session, settings and layout, then renders `DashboardHome`. |
| `/dashboard/customize` | `frontend/src/app/dashboard/customize/page.tsx` | Full-page editor with a live preview. |
| `/dashboard/demo` | `frontend/src/app/dashboard/demo/page.tsx` | Plan walkthrough (Starter / Pro / Enterprise). |
| `/dashboard/demo/dashboards` | `frontend/src/app/dashboard/demo/dashboards/page.tsx` | Sub-dashboard demos, one product area at a time. |
| `/dashboard/settings` | `frontend/src/app/dashboard/settings/page.tsx` | Workspace settings, including the Business section. |

Sidebar navigation lives in `frontend/src/components/dashboard/shell.tsx`
(the `nav` array). Groups are: **Overview**, **AI Search Visibility**,
**GEO Website Audit**, **Competitor Intelligence**, **AI Content Optimization**,
**Monitoring & Reporting**, **Demo & Comparison**, and **Workspace**. The first
item is Overview → *Dashboard Home*; *Demo & Comparison* links the two demo
routes and the three plan shortcuts.

---

## 2. The block model

A layout is just an ordered list of block ids plus a preset label:

```ts
type DashboardLayout = {
  preset: string;   // "executive" | "growth" | ... | "custom"
  blocks: string[]; // ordered, valid block ids only
};
```

- `preset` is **display metadata** (the header says “Executive view” or
  “Custom view”). Deliberate edits set it to the reserved id `"custom"`, which
  is kept by the normaliser but is **not** an entry in `DASHBOARD_PRESETS`. It
  does not itself decide the blocks.
- `blocks` is the source of truth for what renders and in what order.

### Components

| Component | Responsibility |
| --- | --- |
| `components/dashboard/dashboard-home.tsx` | Inline editor + rendering on `/dashboard`. Owns save state and calls `/api/dashboard/layout`. |
| `components/dashboard/dashboard-customizer.tsx` | Full-page editor on `/dashboard/customize` with live preview. Same model, same API. |
| `components/dashboard/dashboard-blocks.tsx` | The renderer. Maps a block id → one component, reads live workspace data once, and shows empty states. |
| `components/dashboard/panel.tsx` | `DashboardHeader` / `Panel` / `StatusChip`. Heading level is controlled by `level`. |
| `hooks/use-workspace-data.ts` | Client hook: fetches `/api/workspace/data`, returns `{ data, loading, source }`. |
| `lib/workspace-data.ts` | Pure merge/derive helpers that turn raw rows into what blocks display. |
| `lib/dashboard-config.ts` | Engine keys/labels/colors and shared row types. Configuration only — no data. |

---

## 3. Registry (the single list of valid blocks)

There are **two copies** and they must agree:

- **Authoritative:** `backend/src/db/dashboard-layout.ts`
- **Mirror:** `frontend/src/lib/dashboard-layout.ts` (so the app works with no backend)

The backend validates every layout it accepts; the frontend copy is a fallback
catalogue. The API returns its own registry, so drift is visible at runtime
rather than fatal.

### Groups

`DASHBOARD_BLOCK_GROUPS` — five product areas. A block belongs to exactly one.

| id | label |
| --- | --- |
| `visibility` | AI Search Visibility |
| `audit` | GEO Website Audit |
| `competitor` | Competitor Intelligence |
| `content` | AI Content Optimization |
| `monitoring` | Monitoring & Reporting |

### Blocks

| id | label | group | Rendered by | Data source |
| --- | --- | --- | --- | --- |
| `kpis` | Headline KPIs | visibility | `KpisBlock` | `mergeOverviewKpis` (latest visibility scan, prompts, citations, competitors) |
| `trend` | Mention rate trend | visibility | `TrendBlock` | `mergeVisibilityTrend` (completed `visibility` scans) |
| `sov` | Share of voice | visibility | `SovBlock` | `mergeShareOfVoice` + `mergeEngineMentionRate` (competitors + prompts) |
| `prompt-coverage` | Prompt coverage | visibility | `PromptCoverageBlock` | `mergePrompts` + `PromptMatrix` |
| `audit-score` | Site health score | audit | `AuditScoreBlock` | `mergeAudit` (latest completed `audit` scan) |
| `audit-issues` | Open audit issues | audit | `AuditIssuesBlock` | `mergeAudit().issues` (`audit_issues` rows) |
| `crawler-access` | AI crawler access | audit | `CrawlerAccessBlock` | `CrawlerBots` → `GET /api/crawler/robots` |
| `competitor-compare` | Competitor comparison | competitor | `CompetitorCompareBlock` | `workspace.competitors` + citations |
| `content-gaps` | Content gaps | competitor | `ContentGapsBlock` | `mergeContentGaps` |
| `content-pipeline` | Content pipeline | content | `ContentPipelineBlock` | `mergeContentItems` (`content_items`) |
| `opportunities` | Top opportunities | content | `OpportunitiesBlock` | `mergeOpportunities` (prompts never cited) |
| `alerts` | Open alerts | monitoring | `AlertsBlock` | `alerts` rows |
| `schedule` | Scheduled checks | monitoring | `ScheduleBlock` | `workspace.settings` (`runDay`, `digest`, `timezone`) |
| `activity` | Recent activity | monitoring | `ActivityBlock` | `mergeActivity` (alerts, scans, reports) |
| `tool-categories` | Tool categories | monitoring | `ToolCategoriesBlock` | Static links to the five tool areas |

`tool-categories` is the only block with no live data — it is navigation.

### Presets

`DASHBOARD_PRESETS` — six starting points. Stable ids, because they are stored
in user layouts.

| id | name | blocks |
| --- | --- | --- |
| `executive` | Executive | `kpis`, `trend`, `activity` |
| `growth` | Growth | `kpis`, `sov`, `opportunities`, `alerts` |
| `seo` | SEO & Technical | `audit-score`, `audit-issues`, `crawler-access`, `opportunities` |
| `competitor` | Competitive watch | `competitor-compare`, `content-gaps`, `sov`, `alerts` |
| `content` | Content | `content-pipeline`, `opportunities`, `kpis`, `activity` |
| `monitoring` | Monitoring | `alerts`, `schedule`, `activity`, `kpis` |

`DEFAULT_PRESET_ID = "executive"`.

---

## 4. Validation and persistence

### Normalisation

`normalizeDashboardLayout(input)` exists in both registries and is the only
entry point for a layout from a client:

- unknown `preset` → `executive` (the reserved id `custom` is preserved)
- unknown block ids → dropped
- duplicate ids → removed
- empty result → the preset's own blocks

It is deliberately forgiving: a stale or hostile id must never break the page.

### Where the layout is stored

The layout lives in the workspace settings blob, under `dashboardLayout`:

- **Postgres:** the `settings` table row for the workspace (`key = 'workspace_settings'`),
  as part of the JSON `value`.
- **Local fallback:** the frontend JSON store written by `saveSettings`.

Read precedence for settings (`GET /api/settings`) is:
`workspace.settings` JSON **overlaid by** the settings-table row (overlay wins).
That is why `dashboardLayout` — written only to the overlay — survives a reload.

### API

| Method | Path | Auth | Behaviour |
| --- | --- | --- | --- |
| `GET` | `/api/dashboard/layout` | yes | Returns `{ layout, blocks, groups, presets }`. Normalises on read. |
| `PATCH` | `/api/dashboard/layout` | yes | Normalises body, merges `dashboardLayout` into the settings row, returns the stored layout. |
| `PATCH` | `/api/settings` | yes | Accepts `dashboardLayout` too, and normalises it (belt and braces). |

Frontend proxies: `frontend/src/app/api/dashboard/layout/route.ts`.

- `GET` prefers the backend; falls back to the local store (`source: "local"`).
- `PATCH` normalises **before** forwarding, forwards to the backend when a
  backend token exists, and falls back to local storage only when the backend
  is unreachable (status 0), returns 401, or fails with 5xx. A 4xx from the
  backend (other than 401) is surfaced to the caller rather than silently
  stored locally.
- Both set `Cache-Control: no-store`.

Server-side reads go through `frontend/src/server/settings.ts`:

```ts
const [settings, layout] = await Promise.all([
  resolveSettings(session),        // merges backend + local defaults
  resolveDashboardLayout(session), // normalised settings.dashboardLayout
]);
```

`resolveSettings` is the only supported way for a server component to read
workspace settings. Reading the local store directly is a bug: the user's save
went to the backend, so the page would show stale values.

---

## 5. Data flow

```
Postgres ──► backend GET /api/workspace/data ──► frontend /api/workspace/data
                                                        │
                    useWorkspaceData()  ◄────────────────┘
                            │
                    merge* helpers (lib/workspace-data.ts)
                            │
                    DashboardBlocks ──► per-block components
```

- The backend route (`backend/src/index.ts`, `GET /api/workspace/data`) scopes
  every table by `request.user.workspaceId`, joins competitor prompts through
  the owned competitors, and strips webhook secrets.
- The frontend route proxies it with the session's backend token and returns
  `{ ok, data, source }`. With no backend reachable it returns
  `{ ok: true, data: null, source: "local" }`.
- `useWorkspaceData` fetches once on mount; saving a layout calls
  `router.refresh()` but does **not** refetch block data.

### The empty-state rule

**No block invents a number.** Every value derives from rows the workspace
actually has. When there are no rows, the block renders `EmptyState` with a
sentence explaining what will populate it.

If you add a block, derive it in `lib/workspace-data.ts` (pure function, takes
`WorkspaceData | null`, returns display rows) and return an empty collection
when the input is empty. Do not add sample/demo values to the real dashboard —
the plan demo is the place for illustrative figures, and it says so on the page.

---

## 6. Customisation UX

Two surfaces share one model:

- **Inline** (`dashboard-home.tsx`): “Customise” toggles a panel above the
  blocks. Presets, reorder up/down, hide, add.
- **Full page** (`dashboard-customizer.tsx`): same controls plus a live preview
  (`showPreview`).

Behaviour worth preserving:

- Every edit calls the API and waits for the response; there is no optimistic
  update. The returned (normalised) layout replaces local state, and a failed
  save shows “could not save”.
- Reorder uses `aria-label="Move <label> up/down"`; hide uses
  `aria-label="Hide <label>"`. Automated checks rely on these.
- An empty layout is never persisted: `normalizeDashboardLayout` backfills the
  default preset's blocks when the list is empty. `DashboardBlocks` still has
  an “empty dashboard” branch as a defensive fallback for stored data.
- Reset goes to the `executive` preset, not to “no blocks”.

---

## 7. Demos

### Plan comparison (`/dashboard/demo`)

A deliberate, clearly-labelled walkthrough of Starter / Pro / Enterprise. It
contains **sample** counts (locations, prompts, competitors, citations) and a
banner saying they are illustrative. `?plan=starter|pro|enterprise` selects the
starting tab. Do not treat its figures as workspace data, and do not import
them into `lib/workspace-data.ts`.

### Sub-dashboards (`/dashboard/demo/dashboards`)

Renders one product area at a time using the **real** blocks and the
**workspace's own** data:

```tsx
DASHBOARD_BLOCKS.filter((b) => b.group === group).map((b) => b.id)
```

Each group is introduced with the question it answers (`GROUP_INTRO`) and the
blocks it owns. This page is the fastest way to check a new block in isolation.

Implication: a new block must be assigned a group that exists in
`DASHBOARD_BLOCK_GROUPS`, or it will not appear in the sub-dashboard demo.

---

## 8. Guardrails

1. **Exactly one `<h1>` per page.** `Panel` and `DashboardHeader` render `h1`
   by default; pass `level={2}` to every subsequent panel on the page. The
   heading audit fails on duplicates.
2. **Keep both registries in sync.** Order, ids, labels and descriptions must
   match. Change the backend first, then mirror it.
3. **Normalise on read and write.** Never persist or render an unvalidated
   block list.
4. **No fabricated data on the real dashboard.** Empty rows → empty state.
5. **Blocks must work at any width.** The renderer wraps everything in
   `@container`; use container variants (`@sm:`, `@3xl:`, `@4xl:`) rather than
   viewport breakpoints so a block looks right on the home page, in the narrow
   live preview, and on the sub-dashboard demo.
6. **Use design tokens.** `text-chalk`, `text-mist`, `text-mist-dim`,
   `border-line`, `bg-surface/*`, `elevate`, plus the accent tokens
   (`iris`, `aqua`, `mint`, `gold`, `coral`). Chart series colours come from
   `ENGINE_COLORS`; a few one-off bar/segment colours are inlined in
   `dashboard-blocks.tsx` — prefer adding a token over copying a new hex.
7. **Stable ids.** Block ids and preset ids are persisted. Renaming one orphans
   existing layouts (unknown ids are dropped). Prefer adding over renaming.
8. **Preset labels are display-only.** Editing blocks sets `preset: "custom"`;
   do not infer blocks from the preset at render time.

> Known quirk: if a preset id is removed from the registry, layouts that stored
> it normalise to `preset: "executive"` while **keeping their blocks**. The
> header then reads “Executive view” for a custom arrangement. Deprecate rather
> than delete preset ids where possible.

---

## 9. Adding a block

1. **Backend registry** — add an entry to `DASHBOARD_BLOCKS` in
   `backend/src/db/dashboard-layout.ts` with `id`, `label`, `group`,
   `description`. Add the id to any preset where it belongs.
2. **Frontend mirror** — copy the same entry into
   `frontend/src/lib/dashboard-layout.ts`.
3. **Derive the data** — add a pure `mergeX(data)` helper to
   `frontend/src/lib/workspace-data.ts`. Handle `null` and empty rows.
4. **Render it** — import the helper in
   `frontend/src/components/dashboard/dashboard-blocks.tsx`, add a
   `case "<id>":` to `DashboardBlockView`, and implement the component. Use
   `Panel level={2}` (the page owns the `h1`) and an `EmptyState`.
5. **Verify** — run `npm run build` in `frontend/`, then check:
   - `/dashboard` renders it when enabled;
   - `/dashboard/customize` lists it under *Add a block*;
   - `/dashboard/demo/dashboards` shows it under its group;
   - the block looks right at narrow width.

Skeleton:

```tsx
function ExampleBlock({ data }: { data: WorkspaceData | null }) {
  const rows = mergeExample(data);
  return (
    <Panel level={2} title="Example" sub="What this measures">
      {rows.length === 0 ? (
        <EmptyState title="Nothing tracked yet" sub="Run a scan to populate this." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-line bg-surface/50 p-4">
              {/* ... */}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
```

## 10. Adding a preset

1. Append to `DASHBOARD_PRESETS` in the backend registry, then mirror it.
2. Use an id that will not change (`kebab-case`).
3. Reuse existing block ids only.
4. Run `normalizeDashboardLayout` mentally against it: every id must be in
   `DASHBOARD_BLOCKS`, or it will be silently dropped.

---

## 11. Testing checklist

There is no committed test suite for the dashboard yet; these are the checks to
run after a change.

**Builds**

```bash
cd backend  && npx tsc --noEmit && npm run lint && npm run build
cd frontend && npm run build
```

**API (backend on `:3001`)**

- `GET /api/dashboard/layout` with a session → `layout`, `blocks`, `groups`, `presets`.
- `PATCH` with a valid layout → echoed back and persisted.
- `PATCH` with `{ preset: "<script>", blocks: ["kpis", "nope", "kpis", 42] }`
  → normalised to `executive` + `["kpis"]`.
- `GET` without a session → 401.
- `PATCH /api/settings` with `{ dashboardLayout }` → normalised on storage.

**UI**

- Applying a preset changes the blocks and the header label.
- Reordering a block changes the order **and** survives a reload.
- Hiding a block persists across a reload; hiding every block is normalised
  back to the default preset's blocks (empty layouts are never stored).
- `/dashboard/demo/dashboards` switches groups and renders real blocks.
- Theme toggle still works; no uncaught JS errors.

**Regression traps**

- The demo workspace must end on a multi-block layout and its own name — a
  bogus-layout PATCH or a settings rename in a test can otherwise leave it in a
  one-block state and make later reorder checks look broken.
- Behind the frontend proxy all requests share one source address; if you raise
  traffic in a test, the backend rate limit (`RATE_LIMIT_MAX`, default 1000/min)
  must be high enough, or writes will 429.

---

## 12. Related documents

- `README.md` — running the stack, environment variables, Docker.
- `backend/src/db/dashboard-layout.ts` — canonical registry and normaliser.
- `frontend/src/lib/dashboard-layout.ts` — mirror, plus `blockById`.
