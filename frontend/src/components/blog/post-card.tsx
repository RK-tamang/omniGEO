import Link from "next/link";
import { formatPostDate, type PostMeta } from "@/lib/blog-shared";
import { AuthorAvatar, PostCover } from "@/components/blog/post-cover";

export function PostCard({ post }: { post: PostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="glass glass-hover group flex h-full flex-col overflow-hidden rounded-2xl"
    >
      <PostCover accent={post.accent} label={post.category} className="h-40" />
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-2.5 font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">
          <time dateTime={post.date}>{formatPostDate(post.date)}</time>
          <span className="size-0.5 rounded-full bg-line-strong" />
          <span>{post.readTime} min read</span>
        </div>
        <h3 className="mt-3 text-lg font-medium leading-snug text-chalk transition-colors group-hover:text-chalk">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-mist">{post.description}</p>
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <span className="flex items-center gap-2.5">
            <AuthorAvatar name={post.author} />
            <span className="text-xs text-mist">{post.author}</span>
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden
            className="text-mist-dim transition-transform duration-300 group-hover:translate-x-1 group-hover:text-iris"
          >
            <path
              d="M1 7h12m0 0L8 2m5 5L8 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export function FeaturedPostCard({ post }: { post: PostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="glass glass-hover group grid overflow-hidden rounded-3xl lg:grid-cols-[1.05fr_1fr]"
    >
      <PostCover accent={post.accent} label={post.category} index="featured" className="min-h-[15rem] lg:min-h-[22rem]" />
      <div className="flex flex-col justify-between p-7 sm:p-9">
        <div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[0.62rem] uppercase tracking-widest text-mist-dim">
            <span className="rounded-full border border-line px-2.5 py-1 text-mist">Latest</span>
            <time dateTime={post.date}>{formatPostDate(post.date)}</time>
            <span className="size-0.5 rounded-full bg-line-strong" />
            <span>{post.readTime} min read</span>
          </div>
          <h2 className="text-balance mt-5 text-2xl font-semibold leading-tight tracking-tight text-chalk sm:text-3xl">
            {post.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-mist sm:text-base">{post.description}</p>
        </div>
        <div className="mt-7 flex items-center justify-between border-t border-line pt-5">
          <span className="flex items-center gap-2.5">
            <AuthorAvatar name={post.author} />
            <span>
              <span className="block text-sm text-chalk">{post.author}</span>
              <span className="block text-xs text-mist-dim">{post.role}</span>
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-mist transition-colors group-hover:text-chalk">
            Read article
            <svg
              width="13"
              height="13"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              <path
                d="M1 7h12m0 0L8 2m5 5L8 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
