import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How OmniGEO collects, uses, stores and protects your personal data and your workspace content — including what we never do with it.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "22 October 2026";

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>
          OmniGEO is operated by Optivus Technologies, a company registered in India. We are the data controller for
          personal data handled through our product, our website and our sales process.
        </p>
        <p>
          This policy explains what we collect, why we collect it, how long we keep it and what you can ask us to do
          with it. It is written to be read, not to be survived.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <p>We collect three broad categories of information, and we only collect them when we need them.</p>
        <h3>Account information</h3>
        <p>
          Your name, email address, password (stored as a salted hash, never in plain text), plan and workspace
          membership. This is what lets you log in and keeps your account attached to your data.
        </p>
        <h3>Workspace content</h3>
        <p>
          The domains you track, the prompts you research, the content you generate and the scans we run for you. This is
          the product. It is isolated per workspace, and you can export or delete it at any time.
        </p>
        <h3>Usage and diagnostic information</h3>
        <p>
          Pages viewed, features used, error logs and coarse device information such as browser type and screen size.
          We use this to keep the product working and to decide what to build next.
        </p>
        <h3>What we do not collect</h3>
        <p>
          We do not buy contact lists, we do not run third-party advertising trackers, and we do not collect the
          contents of your private browsing or your personal email.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use your data",
    body: (
      <>
        <p>We use your data for four purposes, and nothing else:</p>
        <ul>
          <li>
            <strong>To provide the service.</strong> Running scans, generating reports, ranking prompts and billing you
            correctly all require your data.
          </li>
          <li>
            <strong>To improve the product.</strong> Aggregated, de-identified usage patterns tell us which features
            are useful and which are confusing.
          </li>
          <li>
            <strong>To communicate with you.</strong> Service messages, receipts, and — if you ask for it — occasional
            product notes. Every marketing email has a one-click unsubscribe.
          </li>
          <li>
            <strong>To meet our legal obligations.</strong> Tax records, fraud prevention and responding to lawful
            requests.
          </li>
        </ul>
        <p>
          We do not sell your personal data. We do not share your workspace content with other OmniGEO customers, and
          we never use it to train models.
        </p>
      </>
    ),
  },
  {
    id: "ai-processing",
    title: "How AI is used",
    body: (
      <>
        <p>
          OmniGEO exists to tell you what AI engines say about your brand, so it necessarily uses AI models — as
          consumers, on your behalf.
        </p>
        <p>
          When you run a scan, we query third-party AI engines with the prompts you selected and record what they
          return. Your prompts and responses travel to those providers under their own terms. We do not send private
          workspace content to model providers for training, and we do not use one customer&rsquo;s content to improve
          another customer&rsquo;s results.
        </p>
        <p>
          Content you generate with the GEO Writer is sent to the model provider you are working with in order to
          produce the draft. You control which content enters that flow.
        </p>
      </>
    ),
  },
  {
    id: "processors",
    title: "Service providers and sub-processors",
    body: (
      <>
        <p>
          We work with a small number of processors who host our infrastructure, send transactional email, and provide
          the AI models and search data that make the product work. Each is bound by contract to process your data only
          on our instructions.
        </p>
        <p>
          Our current sub-processors are listed on the{" "}
          <a href="/data-processing">Data Processing</a> page, along with what each one receives and where it runs.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep data",
    body: (
      <>
        <p>
          Account data is kept for as long as your account is active. When you delete your workspace, we remove the
          associated content from production within thirty days and from backups within ninety days.
        </p>
        <p>
          If you close your account without deleting it, we keep the account for thirty days in case you change your
          mind, then erase it. Invoices and tax records are retained for the period Indian tax law requires, and are
          never used for marketing.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <>
        <p>
          Data is encrypted in transit with TLS 1.2 or higher, and at rest with AES-256. Sessions use signed, HTTP-only
          cookies, and passwords are hashed with a memory-hard algorithm.
        </p>
        <p>
          Access to production data is limited to the engineers who need it, logged, and reviewed. We run a
          vulnerability scan on every release and commission an independent penetration test annually.
        </p>
        <p>
          No system is perfect. If we discover a breach affecting your data, we will notify you and the relevant
          regulator without undue delay.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>Wherever you live, we will honour the following:</p>
        <ul>
          <li>
            <strong>Access</strong> — get a copy of the personal data we hold about you.
          </li>
          <li>
            <strong>Correction</strong> — fix anything inaccurate or incomplete.
          </li>
          <li>
            <strong>Deletion</strong> — ask us to erase your account and workspace.
          </li>
          <li>
            <strong>Portability</strong> — export your content in a structured, machine-readable format.
          </li>
          <li>
            <strong>Objection and restriction</strong> — tell us to stop processing, or to limit it to a specific
            purpose.
          </li>
        </ul>
        <p>
          We do not charge for this, and we do not make you go through a support queue to a different team. Email us
          and a human will handle it.
        </p>
      </>
    ),
  },
  {
    id: "international",
    title: "International transfers",
    body: (
      <>
        <p>
          We are based in India, and our infrastructure is hosted in the EU and the United States. That means personal
          data may be processed outside your country of residence.
        </p>
        <p>
          Where that happens, transfers are covered by the European Commission&rsquo;s Standard Contractual Clauses or
          an equivalent instrument, and we assess the laws and practices of the receiving country before transferring.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        OmniGEO is a business tool and is not directed at anyone under 18. We do not knowingly collect personal data
        from children. If you believe a child has given us personal data, contact us and we will delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We will update this page when our practices change, and we will change the &ldquo;last updated&rdquo; date at
        the top. If a change materially affects how we use your data, we will email account holders before it takes
        effect.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Privacy Policy"
      intro="What we collect, why we collect it, and what we will never do with it. Written in plain language, because privacy notices nobody can read protect nobody."
      updated={UPDATED}
      sections={sections}
      contactEmail="privacy@omnigeo.io"
    />
  );
}
