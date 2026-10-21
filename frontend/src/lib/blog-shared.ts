export type Accent = "iris" | "aqua" | "mint" | "gold" | "coral";

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  author: string;
  role: string;
  accent: Accent;
  featured: boolean;
  readTime: number;
};

export type Post = PostMeta & { content: string };

export function formatPostDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function estimateReadTime(content: string) {
  const words = content.replace(/[#*`>\-|]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.ceil(words / 220));
}
