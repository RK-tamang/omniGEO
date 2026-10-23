import type { Metadata } from "next";
import { KeywordResearch } from "@/components/dashboard/keyword-research";

export const metadata: Metadata = { title: "Keyword Research" };

export default function KeywordsPage() {
  return <KeywordResearch />;
}
