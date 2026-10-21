import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import {
  formatPostDate,
  getAllPosts,
  getPostBySlug,
  getRelatedPosts,
} from "@/lib/blog";
import { PostCover, AuthorAvatar } from "@/components/blog/post-cover";
import { PostCard } from "@/components/blog/post-card";
import { CtaBand } from "@/components/home/cta-band";
import { Reveal } from "@/components/ui/reveal";
import { site } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      authors: [post.author],
      url: `/blog/${post.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

const mdxComponents = {
  a: ({ href = "", children }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    if (href.startsWith("/")) {
      return <Link href={href}>{children}</Link>;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(post);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.date,
      author: { "@type": "Person", name: post.author },
      publisher: { "@type": "Organization", name: site.name, url: site.url },
      mainEntityOfPage: `${site.url}/blog/${post.slug}`,
      url: `${site.url}/blog/${post.slug}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site.url },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${site.url}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: `${site.url}/blog/${post.slug}` },
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article>
        <header className="relative overflow-hidden pb-10 pt-24 lg:pt-28">
          <div className="grid-bg absolute inset-0" aria-hidden />
          <div className="aurora -top-24 left-1/3 size-[420px] bg-iris/12" aria-hidden />
          <div className="container-page relative">
            <nav aria-label="Breadcrumb" className="font-mono text-[0.7rem] text-mist-dim">
              <Link href="/" className="hover:text-chalk">
                home
              </Link>
              <span className="mx-2 opacity-50">/</span>
              <Link href="/blog" className="hover:text-chalk">
                blog
              </Link>
              <span className="mx-2 opacity-50">/</span>
              <span className="text-mist">{post.category.toLowerCase()}</span>
            </nav>

            <div className="mx-auto mt-8 max-w-3xl">
              <div className="flex flex-wrap items-center gap-3 font-mono text-[0.65rem] uppercase tracking-widest text-mist-dim">
                <span className="rounded-full border border-iris/40 bg-iris/10 px-2.5 py-1 text-chalk">
                  {post.category}
                </span>
                <time dateTime={post.date}>{formatPostDate(post.date)}</time>
                <span className="size-0.5 rounded-full bg-line-strong" />
                <span>{post.readTime} min read</span>
              </div>

              <h1 className="text-balance mt-6 text-3xl font-semibold leading-[1.12] tracking-tight text-chalk sm:text-4xl lg:text-[2.9rem]">
                {post.title}
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-mist">{post.description}</p>

              <div className="mt-8 flex items-center gap-3 border-t border-line pt-6">
                <AuthorAvatar name={post.author} className="size-10" />
                <div>
                  <div className="text-sm font-medium text-chalk">{post.author}</div>
                  <div className="text-xs text-mist-dim">{post.role} · OmniGEO</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="container-page">
          <PostCover
            accent={post.accent}
            label={post.category}
            index={post.date.slice(0, 4)}
            className="mx-auto h-48 max-w-5xl rounded-2xl border border-line sm:h-64"
          />
        </div>

        <div className="container-page">
          <div className="prose-omni mx-auto max-w-3xl pb-10 pt-12">
            <MDXRemote source={post.content} components={mdxComponents} options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }} />
          </div>

          <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-line bg-surface-1 p-6 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <AuthorAvatar name={post.author} className="size-11" />
              <div>
                <p className="text-sm font-medium text-chalk">{post.author}</p>
                <p className="text-xs text-mist-dim">{post.role} · OmniGEO</p>
              </div>
            </div>
            <Link
              href="/blog"
              className="text-sm text-mist underline decoration-line-strong underline-offset-4 transition-colors hover:text-chalk"
            >
              More field notes
            </Link>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="border-t border-line bg-ink-900/40 py-20">
          <div className="container-page">
            <Reveal>
              <p className="kicker mb-4">
                <span className="size-1 rounded-full bg-aqua" />
                Keep reading
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-chalk sm:text-3xl">Related articles</h2>
            </Reveal>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p, i) => (
                <Reveal key={p.slug} delay={i * 80}>
                  <PostCard post={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <CtaBand />
    </>
  );
}
