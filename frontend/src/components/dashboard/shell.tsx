"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { categoryLabel } from "@/lib/business";
import { useEffect, useState } from "react";
import { DashboardTopbar } from "@/components/dashboard/topbar";

export type DashboardUser = { name: string; email: string; plan: string };
export type DashboardWorkspace = {
  name: string;
  plan: string;
  prompts: number;
  /** The domain the workspace tracks. */
  domain?: string;
  /** What the business does. */
  category?: string;
};

const nav = [
  {
    label: "Overview",
    items: [{ label: "Dashboard Home", href: "/dashboard", icon: "home" }],
  },
  {
    label: "AI Search Visibility",
    items: [
      { label: "Visibility Tracker", href: "/dashboard/visibility", icon: "chart" },
      { label: "Prompt Research", href: "/dashboard/prompt-research", icon: "search" },
      { label: "Prompt Tracking", href: "/dashboard/prompt-tracking", icon: "target" },
      { label: "Brand Mentions", href: "/dashboard/brand-mentions", icon: "tag" },
      { label: "Citation Tracker", href: "/dashboard/citations", icon: "link" },
      { label: "Share of Voice", href: "/dashboard/share-of-voice", icon: "users" },
      { label: "Answer History", href: "/dashboard/answer-history", icon: "clock" },
      { label: "Referral Analytics", href: "/dashboard/referrals", icon: "arrow-up-right" },
      { label: "Sentiment", href: "/dashboard/sentiment", icon: "smile" },
      { label: "Geo Visibility", href: "/dashboard/geo-visibility", icon: "globe" },
    ],
  },
  {
    label: "GEO Website Audit",
    items: [
      { label: "GEO Audit", href: "/dashboard/geo-audit", icon: "clipboard" },
      { label: "Crawler", href: "/dashboard/crawler", icon: "bot" },
      { label: "Robots & Crawlability", href: "/dashboard/robots", icon: "file-text" },
      { label: "Schema Validator", href: "/dashboard/schema", icon: "code" },
      { label: "Entity Optimization", href: "/dashboard/entities", icon: "cube" },
      { label: "Readability", href: "/dashboard/readability", icon: "type" },
      { label: "Topical Authority", href: "/dashboard/topical-authority", icon: "layers" },
      { label: "FAQ Optimizer", href: "/dashboard/faq", icon: "help-circle" },
      { label: "Internal Linking", href: "/dashboard/internal-links", icon: "link-2" },
      { label: "Source Readiness", href: "/dashboard/source-readiness", icon: "shield-check" },
      { label: "Technical Monitor", href: "/dashboard/technical-monitor", icon: "alert-triangle" },
    ],
  },
  {
    label: "Competitor Intelligence",
    items: [
      { label: "Competitor Discovery", href: "/dashboard/competitors", icon: "users" },
      { label: "Recommendation Compare", href: "/dashboard/competitor-compare", icon: "git-compare" },
      { label: "Prompt Gap Finder", href: "/dashboard/prompt-gaps", icon: "target" },
      { label: "Citation Sources", href: "/dashboard/competitor-citations", icon: "external-link" },
      { label: "Content Gap Analyzer", href: "/dashboard/content-gaps", icon: "puzzle" },
      { label: "Movement Tracker", href: "/dashboard/competitor-movement", icon: "trending-up" },
      { label: "Page Analyzer", href: "/dashboard/competitor-pages", icon: "file-search" },
      { label: "Market Share", href: "/dashboard/market-share", icon: "pie-chart" },
    ],
  },
  {
    label: "AI Content Optimization",
    items: [
      { label: "GEO Writer", href: "/dashboard/geo-writer", icon: "pen" },
      { label: "Page Optimizer", href: "/dashboard/page-optimizer", icon: "sparkles" },
      { label: "Answer & FAQ Gen", href: "/dashboard/answer-faq", icon: "message-square" },
      { label: "Content Brief Gen", href: "/dashboard/brief-generator", icon: "file-plus" },
      { label: "Entity Coverage", href: "/dashboard/entity-coverage", icon: "check-square" },
      { label: "Source Recommender", href: "/dashboard/source-recommender", icon: "book-open" },
      { label: "Schema Generator", href: "/dashboard/schema-generator", icon: "braces" },
      { label: "Refresh Recommender", href: "/dashboard/refresh-recommender", icon: "refresh-cw" },
      { label: "Landing Compare", href: "/dashboard/landing-compare", icon: "columns" },
      { label: "Quality Scoring", href: "/dashboard/quality-scoring", icon: "award" },
      { label: "Optimization History", href: "/dashboard/optimization-history", icon: "history" },
    ],
  },
  {
    label: "Monitoring & Reporting",
    items: [
      { label: "Scheduled Checks", href: "/dashboard/scheduled-checks", icon: "calendar" },
      { label: "Mention Alerts", href: "/dashboard/mention-alerts", icon: "bell" },
      { label: "Competitor Alerts", href: "/dashboard/competitor-alerts", icon: "bell-ring" },
      { label: "Citation Alerts", href: "/dashboard/citation-alerts", icon: "bell-off" },
      { label: "Site Change Monitor", href: "/dashboard/site-monitor", icon: "eye" },
      { label: "Weekly Reports", href: "/dashboard/weekly-reports", icon: "file-text" },
      { label: "Monthly Reports", href: "/dashboard/monthly-reports", icon: "file-text" },
      { label: "Exports (PDF/CSV)", href: "/dashboard/exports", icon: "download" },
      { label: "White-label", href: "/dashboard/whitelabel", icon: "building" },
      { label: "Notifications", href: "/dashboard/notifications", icon: "mail" },
    ],
  },
  {
    label: "Demo & Comparison",
    items: [
      { label: "Plan Comparison Demo", href: "/dashboard/demo", icon: "columns" },
      { label: "Sub-dashboard Demos", href: "/dashboard/demo/dashboards", icon: "layout-dashboard" },
      { label: "Starter Plan Demo", href: "/dashboard/demo?plan=starter", icon: "rocket" },
      { label: "Pro Growth Demo", href: "/dashboard/demo?plan=pro", icon: "trending-up" },
      { label: "Enterprise Demo", href: "/dashboard/demo?plan=enterprise", icon: "building-2" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Customise Dashboard", href: "/dashboard/customize", icon: "sliders" },
      { label: "Settings", href: "/dashboard/settings", icon: "gear" },
    ],
  },
] as const;

function Icon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}>
      {name === "home" && <> <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /><path d="M9.5 21v-6h5v6" /> </>}
      {name === "sliders" && <> <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><path d="M1 14h6M9 8h6M17 16h6" /> </>}
      {name === "layout-dashboard" && <> <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /> </>}
      {name === "chart" && <> <path d="M3 3v18h18M7 16l3-3 2 2 4-5 4 4" /> </>}
      {name === "search" && <> <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /> </>}
      {name === "target" && <> <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /> </>}
      {name === "tag" && <> <path d="M11 3v6M5 11h14M19 11v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-9a2 2 0 012-2h10" /> </>}
      {name === "link" && <> <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /> </>}
      {name === "users" && <> <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /> </>}
      {name === "clock" && <> <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /> </>}
      {name === "arrow-up-right" && <> <path d="M7 17h10v-10" /><path d="M7 7l10 10" /> </>}
      {name === "smile" && <> <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /> </>}
      {name === "globe" && <> <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /> </>}
      {name === "clipboard" && <> <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /> </>}
      {name === "bot" && <> <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h12M6 12h12M6 16h8" /><path d="M4 12v8" /><path d="M20 12v8" /> </>}
      {name === "file-text" && <> <path d="M14 2v6h6" /><path d="M4 20h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-5l-6-6H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" /><line x1="8" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="12" y2="18" /> </>}
      {name === "code" && <> <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /> </>}
      {name === "cube" && <> <path d="M12 2l10 5v10L12 22l-10-5V7L12 2z" /><path d="M2 12l10 5" /><path d="M22 12l-10 5" /> </>}
      {name === "type" && <> <path d="M4 19v-11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11" /><path d="M8 12h8" /><path d="M12 16h4" /> </>}
      {name === "layers" && <> <polygon points="12 2 2 7 2 17 12 22 22 17 22 7" /><path d="M12 22v-10" /><path d="M2 12l10-5" /><path d="M22 12l-10-5" /> </>}
      {name === "help-circle" && <> <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /> </>}
      {name === "link-2" && <> <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /> </>}
      {name === "shield-check" && <> <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /> </>}
      {name === "alert-triangle" && <> <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /> </>}
      {name === "git-compare" && <> <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><path d="M11 18H8a2 2 0 0 1-2-2V9" /> </>}
      {name === "external-link" && <> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /> </>}
      {name === "puzzle" && <> <path d="M19 7a2 2 0 0 0-2-2H8a2 2 0 0 1-1.68-.71L4 10.29a2 2 0 0 0 0 3.42L6.32 17a2 2 0 0 1 1.68.71h11a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2z" /><path d="M12 11v4h4" /> </>}
      {name === "trending-up" && <> <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 18 23 18 23 12" /> </>}
      {name === "file-search" && <> <path d="M14 2v6h6" /><path d="M4 20h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-5l-6-6H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" /><circle cx="11.5" cy="11.5" r="2.5" /><line x1="14" y1="14" x2="17.5" y2="17.5" /> </>}
      {name === "pie-chart" && <> <circle cx="12" cy="12" r="10" /><path d="M12 2v10h10" /><line x1="12" y1="2" x2="12" y2="12" /> </>}
      {name === "pen" && <> <path d="M11 4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" /><path d="M15 2v20" /> </>}
      {name === "sparkles" && <> <path d="M12 3v18M3 12h18M17 5l-5 5 5 5M7 19l5-5-5-5" /> </>}
      {name === "message-square" && <> <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> </>}
      {name === "file-plus" && <> <path d="M14 2v6h6" /><path d="M4 20h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-5l-6-6H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /> </>}
      {name === "check-square" && <> <path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z" /><polyline points="9 12 11 14 15 10" /> </>}
      {name === "book-open" && <> <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /> </>}
      {name === "braces" && <> <path d="M8 3H7a2 2 0 0 0-2 2v14a2 2 0 0 1-2 2h1" /><path d="M16 21h1a2 2 0 0 0 2-2V5a2 2 0 0 1-2-2h-1" /> </>}
      {name === "refresh-cw" && <> <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M21 12a9 9 0 1 1-9 9 9.75 9.75 0 0 1 6.74-2.74L21 16" /> </>}
      {name === "columns" && <> <rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" /> </>}
      {name === "award" && <> <circle cx="12" cy="8" r="7" /><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.11" /> </>}
      {name === "history" && <> <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /> </>}
      {name === "calendar" && <> <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /> </>}
      {name === "bell" && <> <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /> </>}
      {name === "bell-ring" && <> <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /><path d="M19 10v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2" /> </>}
      {name === "bell-off" && <> <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><line x1="1" y1="1" x2="23" y2="23" /> </>}
      {name === "eye" && <> <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /> </>}
      {name === "download" && <> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /> </>}
      {name === "building" && <> <rect x="3" y="21" width="18" height="3" rx="1" /><path d="M7 21V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12" /><rect x="5" y="12" width="2" height="6" /><rect x="11" y="9" width="2" height="9" /><rect x="17" y="15" width="2" height="3" /> </>}
      {name === "building-2" && <> <path d="M22 21V9a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12" /><rect x="3" y="21" width="18" height="3" rx="1" /><path d="M7 21V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12" /><rect x="5" y="12" width="2" height="6" /><rect x="11" y="9" width="2" height="6" /><rect x="17" y="15" width="2" height="3" /> </>}
      {name === "rocket" && <> <path d="M4.5 16.5c-1.5 1.26-2 5-2.5 6.35-.3.8-.66 1.6-.7 2.5 0 2.5 2.5 4.5 5.5 4.5.6 0 1-.07 1.5-.2.8.2 1.5.6 2 1.3.2-.4.5-1.3.3-2.3-.2-1.4-.9-2.8-2.3-4.4-1.6 1.7-2 5.3-2.5 6.35-.3.8-.66 1.6-.7 2.5 0 2.5 2.5 4.5 5.5 4.5.6 0 1-.07 1.5-.2.8.2 1.5.6 2 1.3.2-.4.5-1.3.3-2.3-.2-1.4-.9-2.8-2.3-4.4" /> </>}
      {name === "mail" && <> <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /> </>}
      {name === "gear" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 1 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 1-1 1.51 1.65 1.65 0 0 1-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 1 .33-1.82V3a2 2 0 0 1 2-2 2 2 0 0 1-2-2h-.09A1.65 1.65 0 0 0 15.4 3a1.65 1.65 0 0 0-1.82-.33l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H15a1.65 1.65 0 0 1-1 1.51z" />
        </>
      )}
    </svg>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Dashboard">
      {nav.map((group) => (
        <div key={group.label}>
          <p className="px-3 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-mist-dim">{group.label}</p>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-iris/12 text-chalk shadow-[inset_0_0_0_1px_rgba(62,124,176,0.25)]"
                        : "text-mist hover:bg-surface-2 hover:text-chalk"
                    }`}
                  >
                    <span className={active ? "text-iris" : "text-mist-dim"}>
                      <Icon name={item.icon} />
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarInner({
  onNavigate,
  workspace,
}: {
  onNavigate?: () => void;
  workspace: DashboardWorkspace;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="font-display text-xl italic text-chalk">
          OmniGEO
        </Link>
        <Link href="/" className="font-mono text-[0.6rem] text-mist-dim transition-colors hover:text-chalk">
          ← site
        </Link>
      </div>
      <NavLinks onNavigate={onNavigate} />
      <div className="border-t border-line p-4">
        <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-3.5">
          <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-iris">Workspace</p>
          <p className="mt-1.5 text-sm text-chalk">{workspace.name}</p>
          <p className="text-xs text-mist-dim">
            {workspace.plan} plan · {workspace.prompts} prompt{workspace.prompts === 1 ? "" : "s"}
          </p>
          {workspace.domain ? (
            <p className="mt-1.5 truncate font-mono text-[0.58rem] text-mist-dim" title={workspace.domain}>
              {workspace.domain}
            </p>
          ) : null}
          {workspace.category ? (
            <p className="mt-0.5 text-[0.62rem] text-mist-dim">{categoryLabel(workspace.category)}</p>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function DashboardShell({
  user,
  workspace,
  children,
}: {
  user: DashboardUser;
  workspace: DashboardWorkspace;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-dvh bg-surface text-mist">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <SidebarInner workspace={workspace} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Dashboard navigation">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface">
            <SidebarInner workspace={workspace} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Mobile top bar with menu trigger */}
        <div className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Open navigation"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-line text-chalk"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-display text-lg italic text-chalk">OmniGEO</span>
          <span className="size-9" />
        </div>

        <DashboardTopbar user={user} workspace={workspace} />

        {/* The page landmark is provided by the root chrome; this is the
            width-constrained container inside it. */}
        <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-10">{children}</div>

        <footer className="mx-auto w-full max-w-6xl px-5 pb-10 sm:px-8">
          <p className="border-t border-line pt-5 font-mono text-[0.62rem] leading-relaxed text-mist-dim">
            Every metric here is read from this workspace&apos;s own tracked data. Sessions are stored in an
            HMAC-signed cookie; accounts live in the OmniGEO backend.
          </p>
        </footer>
      </div>
    </div>
  );
}