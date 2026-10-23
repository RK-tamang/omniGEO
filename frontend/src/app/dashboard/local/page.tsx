import type { Metadata } from "next";
import { LocalSeo } from "@/components/dashboard/local-seo";

export const metadata: Metadata = { title: "Local SEO" };

export default function LocalPage() {
  return <LocalSeo />;
}
