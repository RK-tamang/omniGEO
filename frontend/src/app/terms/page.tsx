import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The agreement that governs your use of OmniGEO — your account, your content, your plan, and the small number of rules that keep the service fair for everyone on it.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "22 October 2026";

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "The agreement",
    body: (
      <>
        <p>
          These terms govern your use of OmniGEO, the website, and any workspace you create on it. By creating an
          account or using the service you accept them. If you are accepting on behalf of a company, you confirm you
          are authorised to bind that company.
        </p>
        <p>
          We may update these terms. Material changes will be announced in the product at least thirty days before they
          take effect, and we will email account holders about anything that reduces a right you already had.
        </p>
      </>
    ),
  },
  {
    id: "your-account",
    title: "Your account",
    body: (
      <>
        <p>
          You are responsible for the activity that happens under your account, including keeping your credentials
          confidential. Tell us promptly if you think someone else has accessed your account.
        </p>
        <p>
          You must be old enough to form a binding contract in your jurisdiction to use OmniGEO, and you may not use the
          service on behalf of anyone else without a workspace invitation.
        </p>
      </>
    ),
  },
  {
    id: "your-content",
    title: "Your content",
    body: (
      <>
        <p>
          You keep every right you already had in the domains, prompts, scans, and content you put into OmniGEO. We
          claim no ownership of it, and we will not resell it or use it to train shared models.
        </p>
        <p>
          You grant us a limited licence to host, process, and display your content only as needed to run the service
          you asked for — for example, to generate a report or to show you last week&rsquo;s scan. That licence ends
          when you delete the content or close the account.
        </p>
        <p>
          You are responsible for having the rights to everything you upload, and for anything you do with the content
          we generate for you. We are a tool, not your lawyer — check the output before you publish it.
        </p>
      </>
    ),
  },
  {
    id: "the-service",
    title: "The service",
    body: (
      <>
        <p>
          OmniGEO reports what AI engines say about your brand, and it does so by querying those engines. Results
          depend on factors we do not control: the engine&rsquo;s model, its retrieval, its location, and the moment it
          was asked. We work hard to keep the data accurate, but we do not guarantee that a given prompt will return a
          given answer, and we do not guarantee that any particular ranking will persist.
        </p>
        <p>
          We will keep the service available and correct. We may change features, and we may retire a feature that
          nobody uses, but we will give you notice before we remove something you are paying for, and we will provide a
          way to export your data.
        </p>
      </>
    ),
  },
  {
    id: "plans-and-billing",
    title: "Plans and billing",
    body: (
      <>
        <p>
          Self-serve plans are billed monthly in advance and renew automatically until cancelled. Trials run for seven
          days and convert to a paid plan only if you choose to keep going — we will remind you before anything is
          charged.
        </p>
        <p>
          You can cancel at any time from the dashboard, with no notice period and no cancellation fee. Access continues
          until the end of the period you have already paid for, and we refund unused annual time on a pro-rata basis
          if you cancel a yearly plan.
        </p>
        <p>
          Fees exclude taxes, and we charge only the taxes we are obliged to collect. If a price changes for an existing
          customer, the new price applies from your next renewal.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to use OmniGEO to:</p>
        <ul>
          <li>break the law, or infringe anyone&rsquo;s rights;</li>
          <li>
            send unsolicited bulk email, or scrape, harvest or spam third-party websites or AI engines;
          </li>
          <li>
            attempt to gain access to another customer&rsquo;s workspace, or to probe, overload or disrupt the service;
          </li>
          <li>
            generate content that is unlawful, that impersonates a real person deceptively, or that deliberately
            misleads;
          </li>
          <li>
            resell, sublicense or provide access to the service except as expressly allowed in a written agreement
            with us.
          </li>
        </ul>
        <p>
          We may suspend an account that is clearly breaching this section. We will tell you why, and we will restore
          the account once the issue is fixed.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party services",
    body: (
      <p>
        OmniGEO queries third-party AI engines and data providers to do its job. Their output is theirs, and their own
        terms and availability apply to it. If a third-party provider changes or discontinues a capability, we may need
        change or retire the feature that depends on it.
      </p>
    ),
  },
  {
    id: "confidentiality",
    title: "Confidentiality",
    body: (
      <p>
        Each of us will treat the other&rsquo;s non-public business information as confidential and use it only to
        perform this agreement. This obligation lasts three years after disclosure, and indefinitely for trade secrets.
      </p>
    ),
  },
  {
    id: "warranties",
    title: "Disclaimer of warranties",
    body: (
      <>
        <p>
          Except as expressly stated, OmniGEO is provided &ldquo;as is&rdquo;, without warranties of any kind. We do not
          warrant that it will be uninterrupted, error-free, or that the insights it produces will improve your
          rankings, traffic or revenue.
        </p>
        <p>
          Nothing in these terms excludes a warranty or right you have under mandatory consumer law in your
          jurisdiction.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <>
        <p>
          Neither party is liable for indirect or consequential loss, or for lost profits, revenue or goodwill. Our
          total liability under these terms is limited to the amount you paid us in the twelve months before the claim
          arose.
        </p>
        <p>
          The service is a business tool. We are not responsible for how you use the output, and a decision you make
          because of it is yours.
        </p>
      </>
    ),
  },
  {
    id: "termination",
    title: "Term and termination",
    body: (
      <>
        <p>
          These terms apply for as long as your account is open. Either of us may end the agreement on thirty days&rsquo;
          written notice, except that we may end it immediately for unpaid invoices or a serious breach of acceptable
          use.
        </p>
        <p>
          When the agreement ends, we will keep your data available for export for ninety days, then delete it in
          line with the retention schedule in our{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </>
    ),
  },
  {
    id: "general",
    title: "General terms",
    body: (
      <>
        <p>
          If any provision of these terms is found unenforceable, the rest stays in force. Your failure to enforce a
          provision does not waive it. These terms are governed by the laws of India, and the courts of Bengaluru have
          exclusive jurisdiction, without affecting any mandatory consumer protections available to you where you live.
        </p>
        <p>
          OmniGEO and its logo are trademarks of Optivus Technologies. These terms grant you no trademark rights, and
          no right to use the word &ldquo;OmniGEO&rdquo; in your own product or company name.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Terms of Service"
      intro="The agreement that governs your use of OmniGEO. It is longer than it needs to be because we would rather be precise than be short."
      updated={UPDATED}
      sections={sections}
      contactEmail="legal@omnigeo.io"
    />
  );
}
