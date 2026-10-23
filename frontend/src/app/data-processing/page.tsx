import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Data Processing",
  description:
    "The processors that touch your data under OmniGEO — what each one receives, why, and where it runs — plus our security and availability commitments.",
  alternates: { canonical: "/data-processing" },
};

const UPDATED = "22 October 2026";

const sections: LegalSection[] = [
  {
    id: "role",
    title: "Our role",
    body: (
      <>
        <p>
          When you use OmniGEO you are the data controller. We act as your data processor: we process personal data on
          your instructions, only to provide the service, and we never use it for our own purposes.
        </p>
        <p>
          This page is the technical annex to the{" "}
          <a href="/privacy">Privacy Policy</a> and the{" "}
          <a href="/terms">Terms of Service</a>. It records who we use, what they receive, and where the processing
          happens.
        </p>
      </>
    ),
  },
  {
    id: "sub-processors",
    title: "Sub-processors",
    body: (
      <>
        <p>
          We use the following processors. Each is bound by contract to process data only on our documented
          instructions, and each has passed a security review before we started sending them anything.
        </p>
        <h3>Infrastructure and storage</h3>
        <ul>
          <li>
            <strong>Amazon Web Services</strong> — primary hosting and database. Receives workspace content, account
            data and diagnostic logs. Runs in Ireland (EU) and Virginia (US).
          </li>
          <li>
            <strong>Cloudflare</strong> — CDN, DNS and DDoS protection. Receives request metadata and IP addresses.
            Runs globally at the edge.
          </li>
        </ul>
        <h3>AI and data providers</h3>
        <ul>
          <li>
            <strong>OpenAI, Anthropic and Google</strong> — language models used to generate content, schema and
            answers. Receive the prompts and content you submit for generation. United States.
          </li>
          <li>
            <strong>DataForSEO</strong> — search and AI-overview data used to answer what engines say about your
            brand. Receives the search queries you run. United States and Singapore.
          </li>
        </ul>
        <h3>Communications</h3>
        <ul>
          <li>
            <strong>Postmark</strong> — transactional email. Receives recipient addresses and message content. United
            States.
          </li>
          <li>
            <strong>Intercom</strong> — support chat and in-product messaging. Receives the content of support
            conversations and your account identifier. United States and Ireland.
          </li>
        </ul>
        <h3>Payments</h3>
        <ul>
          <li>
            <strong>Razorpay</strong> — payment processing. Receives your name, email, billing address and card
            details as entered at checkout. India.
          </li>
        </ul>
        <p>
          We give at least thirty days&rsquo; notice before adding or replacing a sub-processor, and we will honour a
          written objection where a reasonable alternative exists.
        </p>
      </>
    ),
  },
  {
    id: "processing-activities",
    title: "Processing activities",
    body: (
      <>
        <p>For each category of data, we process it for the following purposes:</p>
        <ul>
          <li>
            <strong>Account and authentication data</strong> — to create and secure your account, and to provide
            support. Retained for the life of the account.
          </li>
          <li>
            <strong>Workspace content</strong> — to run scans, generate reports and serve the dashboard. Retained
            until you delete it.
          </li>
          <li>
            <strong>Usage telemetry</strong> — to operate, secure and improve the product. Aggregated and
            de-identified where possible; retained for twenty-six months.
          </li>
          <li>
            <strong>Billing records</strong> — to invoice you and meet tax obligations. Retained for eight years.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "security-measures",
    title: "Security measures",
    body: (
      <>
        <h3>Technical</h3>
        <ul>
          <li>TLS 1.2 or higher for all data in transit; AES-256 encryption at rest.</li>
          <li>Signed, HTTP-only, secure session cookies; salted, memory-hard password hashing.</li>
          <li>Strict workspace isolation enforced at the data layer, not just in the application.</li>
          <li>Least-privilege access to production, with every access logged and reviewed.</li>
          <li>Automated dependency scanning and secret detection on every commit.</li>
        </ul>
        <h3>Organisational</h3>
        <ul>
          <li>Background checks for staff with production access.</li>
          <li>Annual security training, with a simulated phishing exercise each quarter.</li>
          <li>Documented incident response with a 72-hour customer-notification commitment.</li>
        </ul>
      </>
    ),
  },
  {
    id: "availability",
    title: "Availability and recovery",
    body: (
      <>
        <p>
          We target 99.9% monthly availability for the dashboard and scan API, measured across all scheduled
          maintenance windows.
        </p>
        <p>
          Production databases are continuously backed up with point-in-time recovery to a fifteen-minute granularity,
          and daily snapshots are retained in a separate region for thirty-five days. We rehearse a full restore every
          quarter and keep the results of those drills.
        </p>
        <p>
          If we ever experience an extended outage, we will post updates to our status page and to affected account
          holders, whether or not credits are due.
        </p>
      </>
    ),
  },
  {
    id: "return-and-deletion",
    title: "Return and deletion of data",
    body: (
      <>
        <p>
          On termination of the agreement, we return or delete customer data within thirty days of the end of the
          paid period. Backup copies age out within a further sixty days, after which they are unrecoverable.
        </p>
        <p>
          You can export your workspace at any time from the dashboard, in a structured format, without asking us.
        </p>
      </>
    ),
  },
  {
    id: "dpa",
    title: "Signing a DPA",
    body: (
      <>
        <p>
          If you need a data processing agreement for your own compliance — a controller-to-processor agreement, or
          standard contractual clauses — we will sign it. Email us and we will send the current template the same
          working day.
        </p>
        <p>
          We do not charge for a standard DPA, and we do not require you to negotiate it.
        </p>
      </>
    ),
  },
];

export default function DataProcessingPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Data Processing"
      intro="Who touches your data under OmniGEO, what they receive, and where it runs. The part most privacy policies leave out."
      updated={UPDATED}
      sections={sections}
      contactEmail="privacy@omnigeo.io"
    />
  );
}
