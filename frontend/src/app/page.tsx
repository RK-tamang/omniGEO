import { Hero } from "@/components/home/hero";
import { LogoMarquee } from "@/components/home/logo-marquee";
import { ShiftSection } from "@/components/home/shift-section";
import { PlatformSection } from "@/components/home/platform-section";
import { HowItWorks } from "@/components/home/how-it-works";
import { Testimonials } from "@/components/home/testimonials";
import { Audiences } from "@/components/home/audiences";
import { PricingTeaser, FaqSection } from "@/components/home/pricing-faq";
import { BlogPreview } from "@/components/blog/blog-preview";
import { CtaBand } from "@/components/home/cta-band";
import { homeFaqs } from "@/lib/content";
import { site } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    description: site.description,
    foundingDate: "2023",
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: homeFaqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  },
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Hero />
      <LogoMarquee />
      <ShiftSection />
      <PlatformSection />
      <HowItWorks />
      <Testimonials />
      <Audiences />
      <PricingTeaser />
      <FaqSection />
      <BlogPreview />
      <CtaBand />
    </>
  );
}
