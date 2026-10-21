export type Feature = {
  slug: string;
  nav: string;
  kicker: string;
  title: string;
  headline: string;
  description: string;
  accent: "iris" | "aqua" | "mint" | "gold" | "coral";
  bullets: { title: string; body: string }[];
  steps: { title: string; body: string }[];
  metrics: { value: string; label: string }[];
  faq: { q: string; a: string }[];
};

export const features: Feature[] = [
  {
    slug: "ai-visibility",
    nav: "AI Visibility",
    kicker: "AI Search Intelligence",
    title: "AI Visibility",
    headline: "See how ChatGPT, Perplexity, Gemini and AI Overviews describe your brand",
    description:
      "Track the questions your buyers actually ask AI assistants, see which answers name you — and which name your competitors instead — then fix what each engine gets wrong.",
    accent: "iris",
    bullets: [
      {
        title: "Prompt tracking across four engines",
        body: "Every tracked question runs through ChatGPT, Perplexity, Gemini and Google AI Overviews on a schedule, so you see mention rate, sentiment and citation sources for each one separately.",
      },
      {
        title: "Share of voice against competitors",
        body: "When an assistant recommends three vendors and you are not one of them, you know within a day — along with the exact competitor that took your slot and the sources the model trusted.",
      },
      {
        title: "Citation source map",
        body: "See which pages, directories and review sites the models cite when they answer questions in your category. Those are the pages to be present on.",
      },
      {
        title: "Fix recommendations per engine",
        body: "Each engine reads the web differently. Get separate, specific fixes for AI Overviews versus ChatGPT — content gaps, schema, entity clarity and pages to publish.",
      },
    ],
    steps: [
      { title: "Import your market", body: "Pick competitors and the questions your buyers ask. We generate the full prompt set from your site and category." },
      { title: "We query the engines", body: "Your prompt set runs across four AI engines on a schedule, with location and locale held constant so results are comparable." },
      { title: "Get the fix list", body: "Every gap comes with the page to publish or repair, ranked by how often it costs you a mention." },
    ],
    metrics: [
      { value: "4", label: "AI engines tracked" },
      { value: "Daily", label: "refresh cadence" },
      { value: "3.1×", label: "median mention lift in 90 days" },
    ],
    faq: [
      {
        q: "How is this different from checking ChatGPT myself?",
        a: "Manual checks are unlogged, unrepeatable and vary by session. OmniGEO runs a fixed prompt set with constant locale on a schedule, stores every answer, and turns them into trends you can act on and report.",
      },
      {
        q: "Do you track Google AI Overviews too?",
        a: "Yes. AI Overviews are captured alongside ChatGPT, Perplexity and Gemini, with the cited sources recorded for each answer.",
      },
      {
        q: "Can I track prompts in languages other than English?",
        a: "Yes, prompts can be tracked in any language and locale, which matters for local and multi-market brands.",
      },
    ],
  },
  {
    slug: "site-audit",
    nav: "Site Audit",
    kicker: "Technical Health",
    title: "Site Audit",
    headline: "One crawl that checks your site for Google — and for the AI crawlers now reading it",
    description:
      "Find the technical issues costing you rankings and answers. Every crawl checks indexability, Core Web Vitals and schema, plus whether AI crawlers can read the pages you want cited.",
    accent: "aqua",
    bullets: [
      {
        title: "Built for both crawler families",
        body: "Googlebot checks sit beside GPTBot, PerplexityBot and ClaudeBot rules — so a robots rule that blocks answer engines gets flagged before it costs you citations.",
      },
      {
        title: "Issues ranked by traffic at stake",
        body: "Not a list of 4,000 warnings. Issues are grouped, deduplicated and sorted by the traffic and pages they actually affect.",
      },
      {
        title: "Core Web Vitals, page by page",
        body: "Field and lab data per template, with the specific element slowing each page down rather than a generic score.",
      },
      {
        title: "Schema and entity checks",
        body: "Validate structured data and confirm your organization, product and FAQ entities are legible to both search and answer engines.",
      },
    ],
    steps: [
      { title: "Connect your domain", body: "Point us at your site. The first crawl typically completes within a few hours." },
      { title: "Review the ranked issue list", body: "Issues arrive grouped by template and sorted by impact, not alphabetically." },
      { title: "Re-crawl and verify", body: "Every fix is verified on the next scheduled crawl, and the issue closes itself." },
    ],
    metrics: [
      { value: "50k", label: "pages per crawl" },
      { value: "< 6h", label: "typical first crawl" },
      { value: "Weekly", label: "automatic re-crawls" },
    ],
    faq: [
      { q: "Will crawling slow my site down?", a: "We respect crawl-delay and rate-limit ourselves per host. Large sites can also schedule crawls to off-peak windows." },
      { q: "Do you check staging or password-protected areas?", a: "Yes, authenticated crawls are supported on Growth and above." },
      { q: "What if my site is on a page builder?", a: "The audit is platform-agnostic. Where a fix needs a platform change, recommendations say so explicitly." },
    ],
  },
  {
    slug: "keyword-research",
    nav: "Keywords",
    kicker: "Search Demand",
    title: "Keyword Research",
    headline: "See what your buyers search for — and which of your competitors already own it",
    description:
      "Keyword research that separates demand from noise: real search volumes, intent classification, and the competitor pages winning the traffic you want.",
    accent: "mint",
    bullets: [
      {
        title: "Volume, difficulty and intent together",
        body: "Every keyword comes with volume, difficulty and an intent label, so you can tell a buying query from a curiosity query before you spend a quarter on it.",
      },
      {
        title: "Competitor keyword gap",
        body: "Enter three competitors and see the keywords they rank for that you don't, sorted by the traffic those pages actually receive.",
      },
      {
        title: "Winning pages, not just keywords",
        body: "For every gap keyword, we show the exact competitor page winning it — so you know what you are competing against before you brief anything.",
      },
      {
        title: "AI question clustering",
        body: "Keywords are grouped into the questions buyers ask AI assistants, so one research pass feeds both your SEO and AI visibility work.",
      },
    ],
    steps: [
      { title: "Seed from your domain", body: "We expand from your site, your competitors and your category into the full keyword universe." },
      { title: "Filter to what matters", body: "Sort by intent, difficulty and competitor gap until the list is short enough to act on." },
      { title: "Send to the calendar", body: "Chosen keywords flow straight into Content Studio with their intent and cluster attached." },
    ],
    metrics: [
      { value: "26", label: "countries with local volume" },
      { value: "Daily", label: "rank data on tracked terms" },
      { value: "1 click", label: "to send a cluster to content" },
    ],
    faq: [
      { q: "Where does the volume data come from?", a: "A blend of clickstream panels and search engine APIs, refreshed monthly, with the source labelled per keyword." },
      { q: "Can I track my own keyword list?", a: "Yes — import a CSV or add terms directly. Tracking limits depend on your plan." },
      { q: "Does this include AI Overviews presence?", a: "Tracked keywords show whether an AI Overview appears in the SERP and whether you are cited in it." },
    ],
  },
  {
    slug: "rank-tracking",
    nav: "Rank Tracking",
    kicker: "Position Monitoring",
    title: "Rank Tracking",
    headline: "Daily rank tracking by city, device and SERP feature — including AI citations",
    description:
      "Where you rank today, where you ranked yesterday, and which SERP feature took the click. Rank tracking broken down by the locations you actually serve.",
    accent: "gold",
    bullets: [
      {
        title: "Geo-split tracking",
        body: "Track the same keyword from multiple cities side by side, because a national average hides the only ranking that matters to a local branch.",
      },
      {
        title: "Every SERP feature accounted for",
        body: "AI Overviews, featured snippets, maps, video — see which feature occupies the position above you and what it takes to win it.",
      },
      {
        title: "Movement alerts that mean something",
        body: "Alerts fire on movements past a threshold you set, grouped by page cluster, so a Tuesday shuffle does not wake anyone up.",
      },
      {
        title: "Share of voice per market",
        body: "One number per market that reflects how much of the first page you actually own, weighted by volume.",
      },
    ],
    steps: [
      { title: "Add keywords and locations", body: "Import from Keyword Research or paste your own list with the cities you care about." },
      { title: "Choose cadence and alerts", body: "Daily, weekly or on-demand, with alert thresholds per cluster." },
      { title: "Report automatically", body: "Scheduled reports go to stakeholders with the movement explained in plain language." },
    ],
    metrics: [
      { value: "24h", label: "refresh on every keyword" },
      { value: "Unlimited", label: "tracking locations" },
      { value: "24 mo", label: "history retained" },
    ],
    faq: [
      { q: "How do you handle personalized results?", a: "All tracking runs from clean sessions with locale and device pinned, so results are comparable day to day." },
      { q: "Can I track Google Maps pack positions?", a: "Yes, local pack positions are tracked per tracked location on Local SEO plans." },
      { q: "Is click data available?", a: "If you connect Search Console, impressions and clicks appear beside rank in the same view." },
    ],
  },
  {
    slug: "content-studio",
    nav: "Content",
    kicker: "Content Engine",
    title: "Content Studio",
    headline: "Draft content from your own material — with a citation on every knowledge claim",
    description:
      "An AI writer that only writes from the sources you give it. Every factual claim carries a footnote back to your document, so review becomes a check, not a rewrite.",
    accent: "coral",
    bullets: [
      {
        title: "Grounded in your documents",
        body: "Upload product docs, past decks, call transcripts and spec sheets. Drafts are generated strictly from that material — with a source link on every claim.",
      },
      {
        title: "Scored while you write",
        body: "Each draft is scored for coverage, structure and search fit as you type, with the specific fixes that would raise the score.",
      },
      {
        title: "SEO and AI-citation optimised",
        body: "Briefs carry both keyword targets and the AI questions the piece should answer, so one article feeds Google and the answer engines.",
      },
      {
        title: "One calendar, one queue",
        body: "Drafts, reviews and publish dates live on a single calendar with approvals, so nothing ships without a named owner.",
      },
    ],
    steps: [
      { title: "Feed it your knowledge", body: "Connect documents and past content. Everything stays inside your workspace." },
      { title: "Brief and draft", body: "Pick a keyword cluster, get an outline for approval, then a grounded draft with sources." },
      { title: "Score, approve, schedule", body: "Fixes appear as you write. Approve, schedule and track what the piece does after publish." },
    ],
    metrics: [
      { value: "100%", label: "claims source-linked" },
      { value: "6", label: "languages supported" },
      { value: "−70%", label: "time from brief to publish" },
    ],
    faq: [
      { q: "Does it invent facts?", a: "Drafts are constrained to your uploaded material. If a claim has no source, it is flagged and removed rather than guessed." },
      { q: "Can multiple people approve a draft?", a: "Yes — approval chains with named reviewers are available on Growth and above." },
      { q: "Who owns the output?", a: "You do. Content generated in your workspace is yours, and it is never used to train shared models." },
    ],
  },
  {
    slug: "local-seo",
    nav: "Local SEO",
    kicker: "Maps & Locations",
    title: "Local SEO",
    headline: "Rank higher on Google Maps in every area you serve — street by street",
    description:
      "Manage every location's profile, see your map ranking on a geogrid across the areas you serve, and answer every review without opening five tabs.",
    accent: "iris",
    bullets: [
      {
        title: "Geogrid map rank tracking",
        body: "See your map ranking as a grid over each service area. A 3 in one neighbourhood and a 12 two kilometres away stops being a surprise.",
      },
      {
        title: "Profile management in one screen",
        body: "Hours, posts, photos and categories for every location, with change history and who made each edit.",
      },
      {
      title: "Review replies drafted in your voice",
        body: "Each new review arrives with a reply drafted from your past responses and brand guidelines. Approve, edit or schedule it.",
      },
      {
        title: "Consistency checks across directories",
        body: "Name, address and phone mismatches across major directories are surfaced before they suppress your rankings.",
      },
    ],
    steps: [
      { title: "Connect your profiles", body: "Link Google Business Profiles for every location you manage." },
      { title: "Draw your service areas", body: "Set the geogrid over each area you serve and pick tracking density." },
      { title: "Work the queue", body: "Reviews, posts and profile issues arrive as a daily queue per location." },
    ],
    metrics: [
      { value: "250", label: "grid points per geogrid" },
      { value: "Multi-location", label: "workspace support" },
      { value: "AI", label: "review reply drafts" },
    ],
    faq: [
      { q: "How many locations can I track?", a: "Every plan includes at least one location; multi-location packs are available on all tiers." },
      { q: "Do you support Apple Business Connect?", a: "Yes, alongside Bing Places and the major data aggregators." },
      { q: "Can agencies white-label the local reports?", a: "Yes — branded PDF and link reports are included on the Enterprise plan." },
    ],
  },
];

export const getFeature = (slug: string) => features.find((f) => f.slug === slug);

export type Plan = {
  name: string;
  monthly: number;
  yearly: number;
  blurb: string;
  features: string[];
  highlight?: boolean;
};

export const plans: Plan[] = [
  {
    name: "Starter",
    monthly: 4999,
    yearly: 3999,
    blurb: "One location, one market. For teams starting to measure whether AI recommends them.",
    features: ["1 Location", "Prompt Discovery", "10 Prompts", "5 Fixes"],
  },
  {
    name: "Pro Growth",
    monthly: 12999,
    yearly: 10399,
    blurb: "For teams working generative visibility every week, across several markets.",
    features: ["3 Locations", "Discovery Engine", "30 Prompts", "20 Fixes"],
    highlight: true,
  },
  {
    name: "Enterprise",
    monthly: 29999,
    yearly: 23999,
    blurb: "Full discovery across every market you sell in, with room to scale prompts and fixes.",
    features: ["10 Locations", "Full Discovery", "50 Prompts", "50 Fixes"],
  },
];

export const planComparison: { group: string; rows: { label: string; values: string[] }[] }[] = [
  {
    group: "Discovery",
    rows: [
      { label: "Locations", values: ["1", "3", "10"] },
      { label: "Discovery mode", values: ["Prompt Discovery", "Discovery Engine", "Full Discovery"] },
      { label: "Tracked prompts", values: ["10", "30", "50"] },
      { label: "Fixes included", values: ["5", "20", "50"] },
    ],
  },
  {
    group: "AI visibility",
    rows: [
      { label: "AI engines monitored", values: ["✓", "✓", "✓"] },
      { label: "Citation share of voice", values: ["✓", "✓", "✓"] },
      { label: "Competitor overlap", values: ["—", "✓", "✓"] },
      { label: "Answer-engine coverage", values: ["Core", "Extended", "Full"] },
    ],
  },
  {
    group: "Site & crawlers",
    rows: [
      { label: "Site audit", values: ["✓", "✓", "✓"] },
      { label: "AI crawler access checks", values: ["✓", "✓", "✓"] },
      { label: "Pages per crawl", values: ["5,000", "50,000", "Unlimited"] },
      { label: "Crawl cadence", values: ["Weekly", "Daily", "Daily"] },
    ],
  },
  {
    group: "Support",
    rows: [
      { label: "Support", values: ["Email", "Email + Slack", "Dedicated manager"] },
      { label: "Onboarding", values: ["Self-serve", "Guided", "Done with you"] },
    ],
  },
];

export const testimonials = [
  {
    quote:
      "We had no idea we were invisible in AI answers. OmniGEO showed us the exact questions our buyers were asking, how rarely we came up, and what to publish about it. We are now being cited in answers we had never appeared in.",
    name: "Priya Menon",
    role: "Head of Growth",
    company: "Northwind Labs",
    metric: { value: "12 weeks", label: "from invisible to cited" },
  },
  {
    quote:
      "Every AI writing tool we tried invented things — plausible sentences about our own products that were simply not true. OmniGEO writes from the material we give it and shows where each claim came from. Review stopped being a rewrite and became a check.",
    name: "Daniel Okafor",
    role: "Marketing Lead",
    company: "Kestrel Systems",
    metric: { value: "70%", label: "less time to publish" },
  },
  {
    quote:
      "We were paying for four different tools and still guessing about what to publish next. OmniGEO replaced most of that stack and, more usefully, told us what to do rather than handing us more dashboards. The difference showed up in pipeline, not just rankings.",
    name: "Sofia Reyes",
    role: "Director of Marketing",
    company: "Brightline Commerce",
    metric: { value: "2.4×", label: "qualified inbound in 2 quarters" },
  },
] as const;

export const homeFaqs = [
  {
    q: "What is generative engine optimisation (GEO)?",
    a: "GEO is the practice of making sure AI assistants — ChatGPT, Perplexity, Gemini, AI Overviews — mention and cite your brand when buyers ask questions in your category. It sits beside traditional SEO: rankings on Google, mentions in AI answers. OmniGEO measures and improves both from one workspace.",
  },
  {
    q: "How is OmniGEO different from Semrush or Ahrefs?",
    a: "Those tools were built for ten blue links. OmniGEO adds the layer they lack — tracking how answer engines describe your brand, which sources they cite, and what to publish to change that — alongside the keyword, audit and rank work you already expect.",
  },
  {
    q: "Do I need to be technical to use it?",
    a: "No. Audits come with fixes ranked by impact rather than a wall of warnings, content is drafted from your own documents, and every report reads in plain language. Most teams are productive on day one.",
  },
  {
    q: "What happens when my trial ends?",
    a: "Nothing is charged until the 7-day trial ends. You can cancel any time before it ends, or stay on a free read-only tier that keeps your tracked data for 30 days.",
  },
  {
    q: "Can I pay in a currency other than INR?",
    a: "Yes — billing is available in INR, USD and EUR. Prices are displayed in INR by default for Indian billing addresses.",
  },
  {
    q: "How is my data handled?",
    a: "Your documents and workspaces are isolated per account, encrypted at rest and in transit, and never used to train shared models. We are GDPR-ready and sign DPAs on request.",
  },
] as const;
