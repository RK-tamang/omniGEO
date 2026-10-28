export const site = {
  name: "OmniGEO",
  tagline: "Be the brand AI recommends.",
  description:
    "OmniGEO shows you exactly how ChatGPT, Perplexity, Gemini and Google AI Overviews describe your business — then hands you the audit, keywords and content to change it.",
  url: "https://omnigeo.io",
  trialNote: "From ₹4,999/mo · 7-day free trial · Cancel anytime",
};

export const mainNav = [
  { label: "Platform", href: "/#platform" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

export const footerLinks = {
  platform: [
    { label: "AI Visibility", href: "/features/ai-visibility" },
    { label: "Site Audit", href: "/features/site-audit" },
    { label: "Keyword Research", href: "/features/keyword-research" },
    { label: "Rank Tracking", href: "/features/rank-tracking" },
    { label: "Content Studio", href: "/features/content-studio" },
    { label: "Local SEO", href: "/features/local-seo" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
    { label: "Dashboard", href: "/dashboard" },
  ],
} as const;
