// The business profile a new account is set up with.
//
// These are the answers the signup form collects; they become the account's
// defaults — the tracked domain, the brand the engine looks for, the category
// that shapes the prompt templates, and the market the workspace reports on.

export const BUSINESS_CATEGORIES = [
  { value: "saas", label: "SaaS / Software" },
  { value: "ecommerce", label: "Ecommerce / Retail" },
  { value: "agency", label: "Agency / Consultancy" },
  { value: "local", label: "Local business" },
  { value: "marketplace", label: "Marketplace" },
  { value: "media", label: "Media / Publisher" },
  { value: "education", label: "Education / EdTech" },
  { value: "fintech", label: "Finance / Fintech" },
  { value: "health", label: "Health / Wellness" },
  { value: "travel", label: "Travel / Hospitality" },
  { value: "realestate", label: "Real estate" },
  { value: "other", label: "Something else" },
] as const;

export const MARKETS = [
  { value: "en-IN", label: "India — English" },
  { value: "en-US", label: "United States — English" },
  { value: "en-GB", label: "United Kingdom — English" },
  { value: "en-AU", label: "Australia — English" },
  { value: "en-SG", label: "Singapore — English" },
  { value: "en-AE", label: "UAE — English" },
  { value: "de-DE", label: "Germany — German" },
  { value: "es-ES", label: "Spain — Spanish" },
  { value: "fr-FR", label: "France — French" },
  { value: "en", label: "Global — English" },
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]["value"];
export type Market = (typeof MARKETS)[number]["value"];

export function categoryLabel(value: string | undefined | null): string {
  if (!value) return "—";
  return BUSINESS_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function marketLabel(value: string | undefined | null): string {
  if (!value) return "—";
  return MARKETS.find((m) => m.value === value)?.label ?? value;
}

/** Normalise a typed website down to a bare hostname. */
export function normalizeWebsite(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];
}

/** A domain is valid if it looks like `example.com` / `sub.example.com`. */
export function isValidWebsite(raw: string): boolean {
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(normalizeWebsite(raw));
}

export type BusinessProfile = {
  brandName: string;
  category: string;
  website: string;
  market: string;
};
