import type { Metadata } from "next";
import { getAllPosts, getCategories } from "@/lib/blog";
import { BlogFilter } from "@/components/blog/blog-filter";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Field notes on AI search visibility, technical SEO and content that earns the citation. Practical guides from the OmniGEO team.",
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
  const posts = getAllPosts();
  const categories = getCategories();

  return (
    <>
      <section className="relative overflow-hidden pb-10 pt-24 lg:pt-28">
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="aurora -top-24 right-10 size-[440px] bg-iris/14" aria-hidden />
        <div className="container-page relative">
          <Reveal>
            <p className="kicker mb-4">
              <span className="size-1 rounded-full bg-iris" />
              Resources
            </p>
            <h1 className="text-balance max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-chalk sm:text-5xl lg:text-[3.4rem]">
              Field notes on{" "}
              <span className="font-display font-normal italic text-gradient">being found.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-mist">
              Practical writing on AI search, technical SEO, local visibility and content that earns the citation. No
              growth-hack listicles — just what we see working.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <BlogFilter posts={posts} categories={categories} />
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-line pt-6 font-mono text-[0.65rem] text-mist-dim">
              <span>Prefer a feed?</span>
              <a
                href="/blog/rss.xml"
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-mist transition-colors hover:border-line-strong hover:text-chalk"
              >
                <span className="size-1.5 rounded-full bg-gold" />
                RSS
              </a>
              <span className="hidden h-3 w-px bg-line sm:block" />
              <span>{posts.length} articles and counting</span>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
