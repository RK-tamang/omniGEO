# OmniGEO — landing site

Public marketing site for **OmniGEO**, an AI search visibility + SEO platform. Built with Next.js 15 (App Router), TypeScript, Tailwind CSS v4.

Inspired by the *structure* of modern SEO/AI-visibility landing pages — but with its own brand, copy, and a dark, AI-native visual system.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm run build   # production build (static pages + dynamic contact route)
npm start
```

## Pages

| Route | Description |
| --- | --- |
| `/` | Landing page: hero with animated AI-answer demo, logo marquee, Google vs. AI section, platform grid, how it works, testimonials, audiences, pricing teaser, FAQ, CTA |
| `/pricing` | Plans with monthly/yearly toggle, full comparison table, billing FAQ |
| `/features/[slug]` | Six feature pages generated from one data source: `ai-visibility`, `site-audit`, `keyword-research`, `rank-tracking`, `content-studio`, `local-seo` |
| `/about` | Story, principles, stats, team |
| `/blog` | Resource listing: featured post, category filters, search, all articles |
| `/blog/[slug]` | MDX article template with author block, related posts, JSON-LD, and an RSS feed at `/blog/rss.xml` |
| `/login` | Sign-in **and** sign-up page (split layout) — `?intent=signup` opens the create-account tab; no public nav |
| `/scan` | **Free AI visibility scan**: domain input with an animated 6-step scan runner, "what we check" grid, CTA band |
| `/scan/[id]` | Free scan report (noindex): a **trimmed breadcrumb** (`home / scan / domain`) and nothing else above the fold — there is **no hero heading or status-chip row**. The report opens directly on a **two-column workspace**: the active panel on the left (~2/3) and, at the top of the right (~334px) column, a **score card** (score ring + "Grade X"; the ring is the only place the number appears) that also carries the folded-in scan context — the domain, a "Scan complete" marker, and a small Pages / Checks fine / Time / Scan id grid — with the **five tabs stacked vertically** beneath it. **Tabs 1–3 ("Reading your pages", "Site health", "AI crawlers") read for free**; tabs 4–5 (AI answers, Competitors) are **blurred behind a sign-up gate** (`Create free account` / `I already have an account`) that covers the left panel only. Below the workspace: the closing CTA band. The deeper sections (score breakdown, technical checks, engine-by-engine, sample prompts) **and the weakness→fix list** are not shown on the free page — the weakness→fix presentation lives in the tools that fix — Site Audit and Content Studio. Deterministic per domain via `src/lib/scan-data.ts` |
| `/dashboard` | **Auth-gated demo suite** — Overview, AI Visibility, Rank Tracker, Keyword Research, Competitor Analysis, Local SEO, Site Audit, AI Crawler Check, Content Studio, Settings. Middleware-protected, mock data, no public nav/footer. Overview is **report-only** (KPIs, trend, mention rate, opportunities, latest report) and hands off to the tools |
| `/dashboard/settings` | Workspace, region, tracking and notification preferences; persists via `/api/settings` |
| `/contact` | Demo/trial/audit request form (`?intent=audit|demo|trial|enterprise|agency|saas|ecommerce|b2b`) |
| `/api/auth/*` | Auth endpoints: `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/me` |
| `/api/settings` | Session-protected workspace settings (GET/POST, reset) |
| `/api/contact` | Validates and persists contact requests to the local JSON store |
| `/sitemap.xml`, `/robots.txt` | Generated from `src/lib/site.ts`, `src/lib/content.ts` and `src/lib/blog.ts` |

## Design system

- **Palette** — near-black ink (`#05050a`), violet → cyan accents, mint/gold/coral for states. Tokens live in `src/app/globals.css` under `@theme`.
- **Type** — Geist (UI), Geist Mono (labels, data), Instrument Serif italic (accent words in headlines).
- **Surfaces** — `.glass` cards, hairline `white/8` borders, soft aurora glows, a masked grid backdrop and a very subtle film-grain overlay.
- **Motion** — scroll reveals via `IntersectionObserver` (`components/ui/reveal.tsx`), animated typing/answer stream in the hero, and CSS-only marquee/float animations. All motion respects `prefers-reduced-motion`.

### Structure

```
src/
  app/                 routes, layout, metadata, sitemap/robots, API stubs
    blog/              listing, [slug] article route, rss.xml
    dashboard/         auth-gated demo suite (overview + 8 views + settings)
    login/             sign-in page
    scan/              landing (runner) + [id] report route
  components/
    auth/              login form (sign-in + sign-up modes), header auth indicator
    blog/              post cards, cover art, category/search filter, home teaser
    dashboard/         shell (sidebar/topbar), charts, KPI cards, weakness cards, interactive tables, settings form
    home/              landing page sections
    layout/            header, footer, logo, public-chrome (hides marketing nav on /dashboard & /login)
    features/          feature-page mock report panel
    pricing/           billing toggle + plan cards
    scan/              scan runner, score ring, tab shell (scan-tabs) + gated tab panels (panels)
    ui/                buttons, badges, section headings, FAQ, reveal
  content/blog/        MDX articles with frontmatter
  lib/
    auth-session.ts    edge-safe HMAC session tokens + cookie helpers
    content.ts         features, plans, comparison, testimonials, FAQs
    dashboard-data.ts  seeded mock workspace data (prompts, keywords, audit issues, content + 4 tool datasets)
    scan-data.ts       deterministic per-domain scan reports (severities + weaknesses/fixes) for /scan/[id]
    blog.ts            server-only MDX loader, related posts, categories
    blog-shared.ts     post types + date/read-time helpers (client-safe)
    site.ts            brand config + navigation
    format.ts          currency formatting
  middleware.ts        guards /dashboard/* → redirects to /login?next=…
  server/db.ts         JSON-file persistence (users incl. registration, contacts, auth events)
```

## Dashboard & auth (demo)

- Sign in at **`/login`** with `demo@omnigeo.ai` / `demo1234` (or click "Use demo credentials").
- **Create a free account** on the same page (mode tabs: *Sign in* / *Create account*). New accounts are stored in
  the local JSON store with plan `Starter`, role `Owner` and a `"<FirstName>'s workspace"` workspace, and are signed
  in immediately. The scan report's gate links to `/login?intent=signup`, which opens the sign-up tab directly. `POST /api/auth/register` rejects short passwords (400) and duplicate emails (409).
- The marketing header/footer are hidden on `/dashboard/*` and `/login` (`src/components/layout/public-chrome.tsx`).
- Passwords are stored as scrypt hashes and sessions as HMAC-signed `httpOnly` cookies (`src/lib/auth-session.ts`).
- `src/middleware.ts` protects `/dashboard/*`; the layout double-checks the session server-side.
- `/dashboard/settings` edits the workspace, its **domain whitelist**, region, tracking and notification preferences;
  `/api/settings` is session-protected and whitelists keys before persisting.
- **Domain whitelisting.** `settings.whitelist` is the list of hosts the workspace is allowed to scan and optimise;
  the tools never touch anything outside it. Entries are normalised on save (`https://www.Acme.io/pricing` →
  `acme.io`), validated, and de-duplicated, and an all-invalid save is rejected so the list can never go empty. The
  **first entry is the primary domain** and is what the dashboard reports on (`primaryDomain()`); the settings form
  badges it "Primary" and lets you add/remove the rest. A legacy single `settings.domain` is migrated into the list
  on read.
- Accounts, contact requests, auth events and settings persist to `.data/db.json` (git-ignored) via
  `src/server/db.ts` — the seam where Prisma/Postgres or the `/backend` service plugs in later.
- All dashboard numbers come from `src/lib/dashboard-data.ts` (seeded, deterministic mock data).
- **The dashboard reports; the tools fix.** Overview and AI Crawler Check present findings read-only — severity
  totals, category scores, the bot-access matrix — and hand off to the surfaces that actually do the work
  (`/dashboard/audit`, `/dashboard/content`). The paired **weakness→fix** presentation lives in those tools, chiefly
  the **Site Audit** issues list (severity filter, pages affected, detail, "How to fix"). The shared building block is
  `components/dashboard/weakness-card.tsx` (`WeaknessCard` + `sortBySeverity`).
- The public **free scan** funnel (`/scan` → `/scan/[id]`) is the entry point from the "Analyze my site" CTAs;
  reports are generated deterministically from the domain string and always `noindex`. The report is deliberately
  partial: the score card (ring + grade + scan context) and tabs 1–3 are free; tabs 4–5 are gated, and the deeper
  sections and the weakness→fix list are not shown at all.
- Set `AUTH_SECRET` in production; set `AUTH_COOKIE_SECURE=true` when serving over HTTPS.

## Writing a post

Add an `.mdx` file to `src/content/blog/` with this frontmatter:

```yaml
---
title: "Prompts are the new keywords"
description: "One-line summary used on cards and in search results."
date: "2026-09-18"
category: "AI Search" # AI Search | SEO | Content | Local
author: "Meera Iyer"
role: "Head of Design"
accent: "aqua" # iris | aqua | mint | gold | coral
featured: false
---
```

The listing, sitemap, RSS feed, related posts and metadata all update automatically. Markdown tables, code blocks, blockquotes and lists are styled by `.prose-omni` in `globals.css`.

## Content & placeholders

- All customer names, logos, quotes and metrics are **fictional placeholders** — replace them before launch.
- Blog articles in `src/content/blog/` are original sample content; swap or extend them freely.
- The contact endpoint persists to the local JSON store (`src/server/db.ts`). Swap that module for Prisma/Postgres, or hand off to the `/backend` service, without touching callers.
- Pricing is displayed in INR and can be changed in `src/lib/content.ts`.

## Things worth adding next

- Swap `src/server/db.ts` for a real database (Prisma/Postgres) or the `/backend` service
- Case-study pages and a product changelog
- Password reset / multi-user accounts
- Real OG images and analytics
