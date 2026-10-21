"use client";

import { useMemo, useState } from "react";
import type { PostMeta } from "@/lib/blog-shared";
import { FeaturedPostCard, PostCard } from "@/components/blog/post-card";

export function BlogFilter({ posts, categories }: { posts: PostMeta[]; categories: string[] }) {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const map: Record<string, number> = { All: posts.length };
    for (const p of posts) map[p.category] = (map[p.category] ?? 0) + 1;
    return map;
  }, [posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      const matchesCategory = category === "All" || p.category === category;
      const matchesQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [posts, category, query]);

  const showFeatured = category === "All" && !query.trim();
  const featured = posts.find((p) => p.featured);
  const gridPosts = showFeatured && featured ? filtered.filter((p) => p.slug !== featured.slug) : filtered;

  return (
    <>
      <div className="mt-12 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                category === c
                  ? "border-iris/50 bg-iris/15 text-chalk"
                  : "border-line text-mist hover:border-line-strong hover:text-chalk"
              }`}
            >
              {c}
              <span className="ml-2 font-mono text-[0.6rem] text-mist-dim">{counts[c] ?? 0}</span>
            </button>
          ))}
        </div>

        <label className="relative block w-full lg:w-72">
          <span className="sr-only">Search articles</span>
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mist-dim"
            aria-hidden
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles…"
            className="w-full rounded-full border border-line bg-surface-1 py-2.5 pl-10 pr-4 text-sm text-chalk placeholder:text-mist-dim outline-none transition-colors focus:border-iris/60"
          />
        </label>
      </div>

      {showFeatured && featured && (
        <div className="mt-8">
          <FeaturedPostCard post={featured} />
        </div>
      )}

      <div className="mt-8">
        <div className="mb-5 flex items-baseline justify-between">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-mist-dim">
            {showFeatured ? "All articles" : `${category} articles`}
          </p>
          <p className="font-mono text-[0.62rem] text-mist-dim">{filtered.length} total</p>
        </div>

        {gridPosts.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {gridPosts.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        ) : (
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-sm text-mist">No articles match that search.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("All");
              }}
              className="mt-4 text-sm text-chalk underline decoration-iris/50 underline-offset-4 hover:decoration-iris"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </>
  );
}
