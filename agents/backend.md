# OMNIGEO — MASTER BACKEND DEVELOPMENT & API INTEGRATION PROMPT

## PROJECT IDENTITY

Backend name: **OmniGEO**

SaaS product name: **OmniGOE**

Purpose: Build a complete, backend-first, multi-tenant Generative Engine Optimization (GEO) and AI Visibility intelligence platform.

The backend must support the entire AnswerScope navigation, including free GEO tools, Google analytics, AI visibility monitoring, competitor intelligence, subscriptions, credits, scheduled monitoring, and reporting.

No frontend development is required during this phase.

Do not generate a dashboard design. Instead, expose reliable, well-documented REST APIs that can directly power every future dashboard page, tab, metric, chart, table, action and status.

---

# 1. ROLE

Act as a Principal Rust Backend Architect, Senior API Integration Engineer, Web Crawling Security Engineer, SaaS Billing Engineer, and AI Search Data Infrastructure Specialist.

Your responsibility is to inspect the existing OmniGEO codebase, preserve working modules, and implement every required missing backend capability.

If the repository is empty, initialize it.

Do not recreate existing functional engines unnecessarily.

Do not invent provider endpoints, API capabilities, test results or example metrics and present them as live production data.

Use official provider documentation and current supported endpoints.

---

# 2. TECHNICAL STACK

Core:
- Rust stable
- Axum
- Tokio
- Reqwest
- SQLx
- PostgreSQL
- Serde
- tracing
- utoipa / OpenAPI

Authentication:
- WorkOS AuthKit
- Official WorkOS Rust SDK
- Server-managed sessions
- Organization-based authorization
- RBAC

Crawling:
- In-house secure Rust HTTP crawler
- HTML extraction
- XML sitemap parser
- robots.txt parser
- Firecrawl API adapter

External analytics:
- Google Search Console API
- Google Analytics Data API
- Google PageSpeed Insights API

AI:
- OpenAI Responses API
- Gemini API with optional Google Search grounding
- Perplexity's currently supported grounded-answer API
- SerpApi Google AI Overview integration

Processing:
- PostgreSQL-backed durable background jobs
- Independent Rust API and worker binaries
- Usage quotas and credit reservations
- Optional Redis
- S3-compatible object storage when necessary

Use a modular monolith architecture. Avoid unnecessary microservices.

---

# 3. EXPECTED PROJECT STRUCTURE

omnigeo/
  apps/
    api/
    worker/

  crates/
    core/
    api_contracts/
    authentication/
    organizations/
    projects/
    entitlements/
    metering/
    jobs/
    crawler/
    extraction/
    firecrawl/
    geo_audit/
    prompt_intelligence/
    ai_observations/
    brand_intelligence/
    citation_intelligence/
    competitor_intelligence/
    google_integrations/
    analytics/
    opportunities/
    optimization_tasks/
    monitoring/
    reporting/
    integrations/
    billing/
    persistence/
    observability/

  migrations/
  config/
  fixtures/
  tests/
  docs/
  scripts/

  Cargo.toml
  Cargo.lock
  .env.example
  docker-compose.yml

Keep actual crate structure pragmatic. Do not create empty crates merely to match the names.

---

# 4. API GATEWAY

Build the OmniGEO Axum API with:

- /api/v1 versioned routing
- WorkOS session authentication
- Organization authorization
- Request validation
- Feature access checks
- Rate limiting
- Consistent error handling
- Pagination
- OpenAPI documentation
- Structured logging
- Request correlation identifiers
- Health and readiness endpoints

Support asynchronous execution using job identifiers.

Do not block HTTP requests while performing lengthy crawls or AI monitoring runs.

All long-running endpoints must return job status information.

---

# 5. WORKOS AUTHKIT INTEGRATION

Use WorkOS AuthKit as the primary authentication provider.

Implement:
- Hosted login redirection
- Authorization callback
- State verification
- Secure authorization-code exchange
- WorkOS user synchronization
- Session creation
- Token validation
- Token refresh
- Logout
- Session revocation
- Signed webhook processing where applicable
- Organization membership synchronization

Use stable WorkOS user identifiers.

Store AnswerScope-specific project and subscription information in PostgreSQL.

Roles:
- Owner
- Admin
- Analyst
- Viewer

Separate RBAC from subscription entitlements.

A newly provisioned organization should receive the Free plan exactly once.

All provisioning must be idempotent.

Do not build a duplicate password authentication system.

---

# 6. ORGANIZATION, PROJECT AND BRAND ENGINE

Create working backend management for:

- Organizations
- Organization members
- Projects
- Domains
- Brand profiles
- Brand aliases
- Competitors
- Target countries
- Languages
- Business industries
- Products and services

Require authorization for all customer-owned resources.

Support secure website ownership verification when operations require proof of control.

Expose CRUD endpoints for projects and brand profiles.

Implement tenant isolation at repository and application-service levels.

---

# 7. ENTITLEMENT ENGINE

Support four subscription plans:

1. Free
2. Starter
3. Best Value
4. Enterprise

Plans must be database-configurable.

Implement feature flags, numeric limits, time-window quotas and retention policies.

Examples:
- max_projects
- audits_per_month
- max_pages_per_audit
- max_concurrent_jobs
- prompt_tracking_limit
- enabled_ai_engines
- enabled_countries
- monitoring_frequency
- competitor_limit
- report_export_limit
- team_member_limit
- included_ai_credits

Do not hardcode subscription names into crawler or analytics services.

Before executing a tool:
1. Authenticate user.
2. Verify workspace membership.
3. Check RBAC.
4. Resolve effective entitlements.
5. Check quota or credits.
6. Atomically reserve required usage.
7. Create authorized job.

The billing engine will update subscription state later, but it must never bypass authorization or quota checks.

---

# 8. SHARED WEBSITE CRAWLER

Build a secure Rust crawler that operates independently of Firecrawl.

Required capabilities:

- HTTP/HTTPS URL validation
- SSRF protection
- Safe DNS resolution
- Validated network connections
- Redirect restrictions
- robots.txt compliance
- Sitemap discovery
- Sitemap index traversal
- Same-site URL discovery
- Crawl depth limits
- Page count limits
- Per-host pacing
- Global concurrency controls
- Timeouts
- Response size limits
- Content-type filtering
- HTML parsing
- Internal/external link extraction
- Canonical URL processing
- Cache reuse
- Crawl checkpointing
- Cancellation
- Error reporting

The crawler must not execute downloaded JavaScript or submit forms.

Never allow targets to reach private/internal networks or cloud metadata endpoints.

For public SaaS crawling, use an isolated worker with outbound network restrictions.

---

# 9. FIRECRAWL INTEGRATION

Implement a Firecrawl provider adapter.

Purpose:
Enhance crawling and content extraction for websites where basic Rust HTML extraction does not provide sufficient content.

Support documented Firecrawl operations as appropriate:
- Scrape a page
- Crawl a website
- Map/discover URLs
- Retrieve task statuses when asynchronous

Do not assume every operation costs one credit.

Store API usage metadata and enforce a configurable monthly Firecrawl budget.

Execution policy:

1. Check valid project and URL.
2. Apply OmniGEO security and scope rules.
3. Prefer cached results where fresh.
4. Attempt normal Rust extraction.
5. Evaluate extraction completeness.
6. Use Firecrawl only when enabled and justified.
7. Verify the fallback does not violate crawl restrictions.
8. Normalize output into the same page data model.
9. Track Firecrawl consumption.
10. Persist source and timestamp.

The free product must continue working when Firecrawl is disconnected, out of credits, rate-limited or unavailable.

Do not promise browser