# OmniGEO

Generative engine optimisation (GEO) for teams that need to know what AI
assistants say about their brand — and what to publish to change it.

The product is two services:

| Service | Stack | Default port | What it owns |
| --- | --- | --- | --- |
| `backend` | Fastify + Drizzle + PostgreSQL 18 | `3001` | users, workspaces, prompts, citations, scans, crawls, audit issues, competitors, alerts, reports, billing, contact requests |
| `frontend` | Next.js (App Router) | `3000` | the marketing site, the dashboard, and the `/api/*` proxy routes that talk to the backend |
| `db` | PostgreSQL 18 | `5432` | the database both of the above read and write |

**The backend is the source of truth.** The frontend reads and writes through
it; it keeps a local JSON store only as an offline fallback for when no
backend is reachable.

---

## Run it locally

```bash
# Database — PostgreSQL 18
createdb omnigeo          # or: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:18

# API — http://localhost:3001
cd backend
npm install
npm run db:migrate      # create the schema
npm run db:init         # seed the demo account (optional)
npm run dev

# Web — http://localhost:3000
cd frontend
npm install
npm run dev
```

The backend reads `DATABASE_URL` from `backend/.env` — point it at your
PostgreSQL 18 instance (default:
`postgres://postgres:postgres@localhost:5433/omnigeo`).

Point the frontend at the backend with `BACKEND_URL` (see
`frontend/.env.example`). With it unset, the frontend falls back to its local
JSON store and no scan engine is available.

The demo account is `demo@omnigeo.ai` / `demo1234`. Its workspace tracks
**testing.com**, so the crawler check reads that site's real robots.txt.

### The free scan needs no account

`/scan` runs a real scan for anyone. The frontend mints a guest session on the
backend, queues an audit and a visibility scan against the domain, polls until
both land, and renders the report. No sign-up, no cookie beyond the session.

---

## Run it with Docker

```bash
docker compose up --build
```

- frontend → <http://localhost:3000>
- backend → <http://localhost:3001> (`GET /health`)
- database → <http://localhost:5432> (PostgreSQL 18)

The database lives in the `omnigeo-pg` volume and survives restarts and
rebuilds. On first boot the backend creates the schema and seeds the demo
account; set `SEED_DEMO=false` to start empty.

The frontend container talks to the backend over the compose network
(`BACKEND_URL=http://backend:3001`), never through the published port.

### Configuration

Both services read their configuration from the environment. Put overrides in a
`.env` file next to `docker-compose.yml`:

```bash
FRONTEND_URL=https://geo.example.com
AUTH_SECRET=<a long random string>
JWT_SECRET=<a long random string>
DATABASE_URL=postgres://user:pass@db:5432/omnigeo
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=omnigeo
DATAFORSEO_LOGIN=...
DATAFORSEO_PASSWORD=...
OPENAI_API_KEY=...
```

Without provider credentials the engine degrades to a deterministic simulated
mode and flags every response it produces with `simulated: true` — the UI
surfaces that rather than presenting the numbers as real.

---

## Where the numbers come from

There is no static demo dataset behind the dashboard. Every figure is derived
from the rows a workspace has actually tracked:

| Surface | Source |
| --- | --- |
| Visibility trend | completed `visibility` scans, per engine |
| Prompt coverage & prompt table | `prompts` rows and their per-engine status |
| Site health & audit issues | the latest `audit` scan's checks, plus `audit_issues` |
| AI crawler access | the domain's live `robots.txt`, parsed per bot |
| Citations & citation sources | `citations` rows |
| Competitors & share of voice | `competitors` rows and `competitor_prompts` |
| Content pipeline & quality scores | `content_items` rows |
| Alerts & activity | `alerts`, `scans` and `reports` |
| Keyword research & local pack | live provider pulls, on request |

Where a workspace has no rows, the panel renders an empty state that says what
to do next — never a placeholder number. The only pages that use illustrative
figures are the two demo pages (`/dashboard/demo` and
`/dashboard/demo/dashboards`), and both say so on the page.

---

## Layout

```
backend/
  src/db/          schema, migrations, dashboard block registry
  src/engine/      the scan runner (visibility, audit, crawler, schema)
  src/services/    crawler, dataforseo, llm, robots.txt parsing
  src/index.ts     every API route
frontend/
  src/app/         routes — marketing, dashboard, and the /api proxy routes
  src/components/  dashboard and marketing components
  src/lib/         dashboard config, workspace data adapters, layout registry
  src/server/      server-only helpers (backend client, settings, sessions)
  src/hooks/       client hooks that read live workspace data
```

## Fonts

The display face is **Gullying**, self-hosted at
`frontend/src/app/fonts/gullying-regular.ttf` and loaded with
`next/font/local` (fallback: Geist Sans). The bundled file is Din Studio's
demo cut, **licensed for personal use only** — replace it with the licensed
file (same filename) before a commercial deployment. Licence text is in
`frontend/src/app/fonts/LICENSE.txt`.

## Docs

- [`docs/dashboard.md`](docs/dashboard.md) — the dashboard reference: block
  registry, presets, layout persistence, customiser, sub-dashboard demos, data
  flow, and the checklist for adding a block.

## Checks

```bash
cd backend  && npm run lint && npm run build
cd frontend && npm run lint && npm run build
```

`npm run build` in the frontend writes `.next` — stop `npm run dev` first, or
the two will fight over the same directory.
