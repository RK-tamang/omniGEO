"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

type Plan = "starter" | "pro" | "enterprise";

const PLANS = {
  starter: {
    name: "Starter",
    price: { monthly: 4999, yearly: 3999 },
    color: "iris",
    icon: "🚀",
    highlight: false,
    blurb: "One location, one market. For teams starting to measure whether AI recommends them.",
    limits: {
      locations: 1,
      prompts: 10,
      fixes: 5,
      discovery: "Prompt Discovery",
      crawlPages: "5,000",
      crawlCadence: "Weekly",
      competitorOverlap: false,
      answerEngineCoverage: "Core",
      support: "Email",
      onboarding: "Self-serve",
    },
    features: {
      aiVisibility: { citationShare: true, competitorOverlap: false, answerEngineCoverage: "Core" },
      siteAudit: { crawlPages: 5000, crawlCadence: "Weekly", aiCrawlerChecks: true },
      support: { level: "Email", onboarding: "Self-serve" },
    },
    demoData: {
      locations: ["Mumbai"],
      prompts: 10,
      trackedQueries: ["best CRM for small business", "AI search visibility guide"],
      competitors: ["HubSpot", "Salesforce"],
      citations: 3,
      visibilityScore: 32,
    },
  },
  pro: {
    name: "Pro Growth",
    price: { monthly: 12999, yearly: 10399 },
    color: "aqua",
    icon: "📈",
    highlight: true,
    blurb: "For teams working generative visibility every week, across several markets.",
    limits: {
      locations: 3,
      prompts: 30,
      fixes: 20,
      discovery: "Discovery Engine",
      crawlPages: "50,000",
      crawlCadence: "Daily",
      competitorOverlap: true,
      answerEngineCoverage: "Extended",
      support: "Email + Slack",
      onboarding: "Guided",
    },
    features: {
      aiVisibility: { citationShare: true, competitorOverlap: true, answerEngineCoverage: "Extended" },
      siteAudit: { crawlPages: 50000, crawlCadence: "Daily", aiCrawlerChecks: true },
      support: { level: "Email + Slack", onboarding: "Guided" },
    },
    demoData: {
      locations: ["Mumbai", "Bangalore", "Delhi"],
      prompts: 30,
      trackedQueries: [
        "best CRM for small business",
        "AI search visibility guide",
        "CRM pricing comparison",
        "enterprise CRM software",
        "best CRM for startups",
      ],
      competitors: ["HubSpot", "Salesforce", "Zoho", "Freshworks", "Pipedrive"],
      citations: 12,
      visibilityScore: 45,
    },
  },
  enterprise: {
    name: "Enterprise",
    price: { monthly: 29999, yearly: 23999 },
    color: "gold",
    icon: "🏢",
    highlight: false,
    blurb: "Full discovery across every market you sell in, with room to scale prompts and fixes.",
    limits: {
      locations: 10,
      prompts: 50,
      fixes: 50,
      discovery: "Full Discovery",
      crawlPages: "Unlimited",
      crawlCadence: "Daily",
      competitorOverlap: true,
      answerEngineCoverage: "Full",
      support: "Dedicated Manager",
      onboarding: "Done with you",
    },
    features: {
      aiVisibility: { citationShare: true, competitorOverlap: true, answerEngineCoverage: "Full" },
      siteAudit: { crawlPages: "Unlimited", crawlCadence: "Daily", aiCrawlerChecks: true },
      support: { level: "Dedicated Manager", onboarding: "Done with you" },
    },
    demoData: {
      locations: ["Mumbai", "Bangalore", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Surat"],
      prompts: 50,
      trackedQueries: [
        "best CRM for small business",
        "AI search visibility guide",
        "CRM pricing comparison",
        "enterprise CRM software",
        "best CRM for startups",
        "CRM for real estate",
        "healthcare CRM solutions",
        "CRM integration guide",
        "mobile CRM apps",
        "CRM automation workflows",
      ],
      competitors: ["HubSpot", "Salesforce", "Zoho", "Freshworks", "Pipedrive", "Microsoft Dynamics", "Oracle", "SAP", "Monday.com", "Notion"],
      citations: 35,
      visibilityScore: 68,
    },
  },
} as const;

type PlanKey = keyof typeof PLANS;
type PlanData = (typeof PLANS)[PlanKey];

const PLAN_KEYS = Object.keys(PLANS) as PlanKey[];

function isPlanKey(value: string | undefined): value is PlanKey {
  return !!value && (PLAN_KEYS as string[]).includes(value);
}

export default function DemoPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  // The sidebar links to /dashboard/demo?plan=starter|pro|enterprise, so the
  // query string has to pick the starting plan.
  const [query, setQuery] = useState<{ plan?: string }>({});

  useEffect(() => {
    let active = true;
    void searchParams.then((sp) => {
      if (active) setQuery(sp);
    });
    return () => {
      active = false;
    };
  }, [searchParams]);

  const [activePlan, setActivePlan] = useState<PlanKey>("pro");

  // Apply the requested plan once it is known, and whenever it changes.
  useEffect(() => {
    if (isPlanKey(query.plan)) setActivePlan(query.plan);
  }, [query.plan]);

  const plan = PLANS[activePlan];

  return (
    <div className="space-y-8">
      <DashboardHeader
        title="Plan comparison demo"
        sub="See exactly what each plan includes, and what the workspace looks like on it."
      />

      <p className="rounded-xl border border-line bg-surface/60 px-4 py-3 font-mono text-[0.62rem] leading-relaxed text-mist-dim">
        This is a plan walkthrough. The figures below illustrate each tier &mdash; they are sample values, not your
        workspace&apos;s data. Your own dashboard shows only what has actually been tracked.
      </p>

      {/* Plan Selector */}
      <div className="flex flex-wrap gap-3">
        {((["starter", "pro", "enterprise"]) as PlanKey[]).map((key) => {
          const p = PLANS[key];
          return (
            <button
              key={key}
              onClick={() => setActivePlan(key)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl border-2 transition-all ${
                activePlan === key
                  ? `border-${p.color} bg-${p.color}/10 text-${p.color}`
                  : "border-line hover:bg-surface-1 text-mist"
              }`}
            >
              <span className="text-xl">{p.icon}</span>
              <span className="font-medium">{p.name}</span>
              {p.highlight && <span className="px-2 py-0.5 text-[0.6rem] font-medium rounded-full bg-aqua/20 text-aqua">Popular</span>}
            </button>
          );
        })}
      </div>

      {/* Plan Overview */}
      <Panel title={`${plan.icon} ${plan.name} Plan Demo`} sub={plan.blurb} level={2}>
        <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
          {/* KPI Cards */}
          <div className="col-span-1 md:col-span-2 lg:col-span-2 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KPICard
                title="Locations"
                value={plan.demoData.locations.length}
                subtitle={`of ${plan.limits.locations} allowed`}
                icon="📍"
                color={plan.color}
              />
              <KPICard
                title="Tracked Prompts"
                value={plan.demoData.prompts}
                subtitle={`of ${plan.limits.prompts} allowed`}
                icon="🎯"
                color={plan.color}
              />
              <KPICard
                title="Citations Earned"
                value={plan.demoData.citations}
                subtitle={`of ${plan.limits.fixes} fixes`}
                icon="🔗"
                color={plan.color}
              />
              <KPICard
                title="Visibility Score"
                value={`${plan.demoData.visibilityScore}%`}
                subtitle="Share of voice"
                icon="📊"
                color={plan.color}
              />
            </div>

            {/* Locations */}
            <LocationsList locations={plan.demoData.locations} color={plan.color} max={plan.limits.locations} />

            {/* Tracked Prompts */}
            <PromptsList prompts={plan.demoData.trackedQueries} color={plan.color} max={plan.limits.prompts} />

            {/* Competitors */}
            <CompetitorsList competitors={plan.demoData.competitors} color={plan.color} />
          </div>

          {/* Feature Comparison Sidebar */}
          <div className="col-span-1 md:col-span-1 lg:col-span-2 space-y-6">
            <FeatureComparison plan={plan} />
            <PricingCard plan={plan} />
            <UpgradeCTA currentPlan={activePlan} />
          </div>
        </div>
      </Panel>

      {/* Navigation to actual dashboard pages */}
      <Panel title="Try It Live" sub="Navigate to actual dashboard pages with demo data" level={2}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Visibility Tracker", href: "/dashboard/visibility", icon: "📊", color: plan.color },
            { label: "Prompt Research", href: "/dashboard/prompt-research", icon: "🔍", color: plan.color },
            { label: "Brand Mentions", href: "/dashboard/brand-mentions", icon: "🏷️", color: plan.color },
            { label: "Citation Tracker", href: "/dashboard/citations", icon: "🔗", color: plan.color },
            { label: "Share of Voice", href: "/dashboard/share-of-voice", icon: "📊", color: plan.color },
            { label: "Competitor Compare", href: "/dashboard/competitor-compare", icon: "⚖️", color: plan.color },
            { label: "GEO Writer", href: "/dashboard/geo-writer", icon: "✍️", color: plan.color },
            { label: "Site Audit", href: "/dashboard/geo-audit", icon: "🔍", color: plan.color },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="group">
              <div className={`flex items-center gap-3 px-4 py-4 rounded-2xl border border-line bg-surface/50 hover:border-${item.color}/30 hover:bg-${item.color}/5 transition-all`}>
                <span className="text-2xl">{item.icon}</span>
                <span className="font-medium text-chalk">{item.label}</span>
                <svg className="ml-auto text-mist-dim group-hover:text-chalk transition-colors" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M19 12l-4 4-4-4" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function KPICard({ title, value, subtitle, icon, color }: { title: string; value: string | number; subtitle: string; icon: string; color: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface/50 p-4 transition-all hover:border-${color}/30`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">{title}</p>
          <p className="text-2xl font-bold text-chalk">{value}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-mist-dim">{subtitle}</p>
    </div>
  );
}

function LocationsList({ locations, color, max }: { locations: readonly string[]; color: string; max: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-chalk">Locations ({locations.length}/{max})</h4>
        {locations.length > 3 && (
          <span className="px-2 py-0.5 text-[0.55rem] font-medium rounded-full border border-line bg-surface/50 text-mist-dim">
            +{locations.length - 3} more
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {locations.slice(0, 5).map((loc) => (
          <span key={loc} className={`px-3 py-1 rounded-full text-sm font-medium ${color === "gold" ? "bg-gold/10 text-gold border border-gold/20" : `bg-${color}/10 text-${color} border border-${color}/20`}`}>
            {loc}
          </span>
        ))}
        {locations.length > 5 && <span className="px-3 py-1 rounded-full text-sm font-medium text-mist-dim">+{locations.length - 5} more</span>}
      </div>
    </div>
  );
}

function PromptsList({ prompts, color, max }: { prompts: readonly string[]; color: string; max: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/50 p-4">
      <h4 className="font-medium text-chalk mb-3">Tracked Prompts ({prompts.length}/{max})</h4>
      <ul className="space-y-2">
        {prompts.slice(0, 5).map((prompt, i) => (
          <li key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface/50 text-sm text-mist">
            <span className={`size-2 rounded-full ${color === "gold" ? "bg-gold" : `bg-${color}`}`} />
            <span className="truncate">{prompt}</span>
          </li>
        ))}
        {prompts.length > 5 && (
          <li className="px-3 py-2 text-sm text-mist-dim text-center">+{prompts.length - 5} more prompts...</li>
        )}
      </ul>
    </div>
  );
}

function CompetitorsList({ competitors, color }: { competitors: readonly string[]; color: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/50 p-4">
      <h4 className="font-medium text-chalk mb-3">Competitors Tracked ({competitors.length})</h4>
      <div className="flex flex-wrap gap-2">
        {competitors.slice(0, 8).map((comp) => (
          <span key={comp} className={`px-3 py-1 rounded-full text-sm font-medium bg-surface/50 text-mist border border-line hover:border-${color}/30 hover:bg-${color}/5 transition-colors`}>
            {comp}
          </span>
        ))}
        {competitors.length > 8 && <span className="px-3 py-1 rounded-full text-sm font-medium text-mist-dim">+{competitors.length - 8} more</span>}
      </div>
    </div>
  );
}

function FeatureComparison({ plan }: { plan: PlanData }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/50 p-4">
      <h4 className="font-medium text-chalk mb-4">Feature Comparison</h4>
      <div className="space-y-3">
        <FeatureRow label="AI Visibility" items={[
          { label: "Citation Share of Voice", included: plan.features.aiVisibility.citationShare },
          { label: "Competitor Overlap", included: plan.features.aiVisibility.competitorOverlap },
          { label: "Answer Engine Coverage", included: true, custom: plan.features.aiVisibility.answerEngineCoverage },
        ]} />
        <FeatureRow label="Site & Crawlers" items={[
          { label: "Site Audit", included: plan.features.siteAudit.aiCrawlerChecks },
          { label: "AI Crawler Access Checks", included: plan.features.siteAudit.aiCrawlerChecks },
          { label: "Pages per Crawl", included: true, custom: plan.limits.crawlPages },
          { label: "Crawl Cadence", included: true, custom: plan.limits.crawlCadence },
        ]} />
        <FeatureRow label="Support" items={[
          { label: "Support Level", included: true, custom: plan.features.support.level },
          { label: "Onboarding", included: true, custom: plan.features.support.onboarding },
        ]} />
      </div>
    </div>
  );
}

function FeatureRow({ label, items }: { label: string; items: { label: string; included: boolean; custom?: string }[] }) {
  return (
    <div className="border-t border-line pt-4 first:border-0">
      <p className="font-mono text-[0.6rem] uppercase tracking-widest text-iris mb-2">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className={item.included ? "text-aqua" : "text-mist-dim"}>
              {item.included ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="Included">
                  <path d="M2 7.5l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="Not included">
                  <path d="M2 2l10 10M12 2l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className={item.included ? "text-chalk" : "text-mist-dim"}>
              {item.custom || item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingCard({ plan }: { plan: PlanData }) {
  return (
    <div className={`rounded-2xl border-2 border-${plan.color}/30 bg-${plan.color}/5 p-4`}>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">Monthly</span>
        <span className="font-display text-3xl font-bold text-chalk">₹{plan.price.monthly.toLocaleString()}</span>
        <span className="text-mist-dim">/mo</span>
      </div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">Yearly (save 20%)</span>
        <span className="font-display text-3xl font-bold text-chalk">₹{plan.price.yearly.toLocaleString()}</span>
        <span className="text-mist-dim">/mo</span>
      </div>
      <p className="text-sm text-mist">{plan.limits.discovery} · {plan.limits.locations} location{plan.limits.locations > 1 ? "s" : ""} · {plan.limits.prompts} prompts · {plan.limits.fixes} fixes</p>
    </div>
  );
}

function UpgradeCTA({ currentPlan }: { currentPlan: string }) {
  const nextPlan = currentPlan === "starter" ? "pro" : currentPlan === "pro" ? "enterprise" : null;
  const plans = { pro: { name: "Pro Growth", price: "₹12,999/mo", color: "aqua" }, enterprise: { name: "Enterprise", price: "₹29,999/mo", color: "gold" } };
  
  if (!nextPlan) return (
    <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 text-center">
      <p className="font-medium text-chalk">You&apos;re on the highest plan!</p>
      <p className="text-sm text-mist-dim mt-1">Enterprise plan includes everything.</p>
    </div>
  );

  const next = plans[nextPlan as keyof typeof plans];
  
  return (
    <div className={`rounded-2xl border border-${next.color}/30 bg-${next.color}/5 p-4`}>
      <p className="font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim mb-2">Upgrade Available</p>
      <p className="font-medium text-chalk mb-1">Upgrade to {next.name}</p>
      <p className="text-sm text-mist-dim mb-4">{next.price} — unlock more locations, prompts, and advanced features.</p>
      <Button variant="secondary" className="w-full" href="/pricing">
        View Pricing
      </Button>
    </div>
  );
}