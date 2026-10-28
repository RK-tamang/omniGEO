/**
 * Typed models for the Citations & Sources dashboard.
 * These mirror the OmniGEO backend visibility/citations response schemas.
 */

/** Ownership classification of a cited domain */
export type DomainOwnership = "own" | "competitor" | "third-party";

/** A single citation observation */
export type CitationObservation = {
  id: string;
  promptId?: string | null;
  prompt?: string | null;
  engine: string;
  provider?: string | null;
  observationType: string;
  model?: string | null;
  domain: string;
  url: string;
  title?: string | null;
  position?: number | null;
  country?: string | null;
  language?: string | null;
  capturedAt: string;
  citationText?: string | null;
  matchEvidence?: Record<string, unknown> | null;
};

/** Aggregated domain-level citation summary */
export type DomainCitation = {
  domain: string;
  ownership: DomainOwnership;
  citingObservations: number;
  uniqueCitedUrls: number;
  uniquePrompts: number;
  engines: string[];
  firstSeen?: string | null;
  lastSeen?: string | null;
  urls: string[];
};

/** Aggregated page-level citation summary */
export type PageCitation = {
  id: string;
  title?: string | null;
  url: string;
  domain: string;
  ownership: DomainOwnership;
  citingObservations: number;
  uniquePrompts: number;
  engines: string[];
  lastSeen?: string | null;
};

/** A competitor citation gap */
export type CitationGap = {
  id: string;
  prompt: string;
  engine: string;
  competitor: string;
  competitorUrl?: string | null;
  customerCited: boolean;
  evidence?: Record<string, unknown> | null;
  priority: "high" | "medium" | "low";
};

/** Time series point for citation trend chart */
export type CitationTrendPoint = {
  date: string;
  ownRate: number;
  competitorRate: number;
  eligibleObservations: number;
};

/** Overview metrics for the citations dashboard */
export type CitationsOverview = {
  ownDomainCitationRate: number;
  uniqueCitedDomains: number;
  uniqueOwnPagesCited: number;
  competitorOnlyGaps: number;
  eligibleObservations: number;
  dataFreshness?: string | null;
  trend: CitationTrendPoint[];
  distribution: {
    own: number;
    competitor: number;
    thirdParty: number;
  };
};

/** Classification helper */
export function classifyDomain(
  domain: string,
  ownDomains: string[],
  competitorDomains: string[],
): DomainOwnership {
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  if (ownDomains.some((d) => d.toLowerCase().replace(/^www\./, "") === normalized)) return "own";
  if (competitorDomains.some((d) => d.toLowerCase().replace(/^www\./, "") === normalized))
    return "competitor";
  return "third-party";
}
