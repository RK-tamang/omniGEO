import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";
import { estimateReadTime, type Accent, type Post, type PostMeta } from "@/lib/blog-shared";

export type { Accent, Post, PostMeta } from "@/lib/blog-shared";
export { formatPostDate } from "@/lib/blog-shared";

const BLOG_DIR = path.join(process.cwd(), "src/content/blog");

function readRaw(slug: string) {
  const raw = fs.readFileSync(path.join(BLOG_DIR, `${slug}.mdx`), "utf8");
  return matter(raw);
}

function readMeta(slug: string): PostMeta {
  const { data, content } = readRaw(slug);

  return {
    slug,
    title: String(data.title),
    description: String(data.description),
    date: String(data.date),
    category: String(data.category),
    author: String(data.author),
    role: String(data.role),
    accent: (data.accent as Accent) ?? "iris",
    featured: Boolean(data.featured),
    readTime: estimateReadTime(content),
  };
}

function readFile(slug: string): Post {
  const { content } = readRaw(slug);
  return { ...readMeta(slug), content };
}

export const getAllPosts = cache((): PostMeta[] => {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => readMeta(f.replace(/\.mdx$/, "")))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
});

export const getPostBySlug = cache((slug: string): Post | null => {
  try {
    return readFile(slug);
  } catch {
    return null;
  }
});

export const getCategories = cache((): string[] => {
  const posts = getAllPosts();
  return ["All", ...Array.from(new Set(posts.map((p) => p.category)))];
});

export function getRelatedPosts(post: PostMeta, limit = 3): PostMeta[] {
  const posts = getAllPosts().filter((p) => p.slug !== post.slug);
  const sameCategory = posts.filter((p) => p.category === post.category);
  const rest = posts.filter((p) => p.category !== post.category);
  return [...sameCategory, ...rest].slice(0, limit);
}
