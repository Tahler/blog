export const BLOG_POST_TAGS = [
  "projects",
  "thoughts",
  "travel",
  "other",
] as const;

export type BlogPostTag = (typeof BLOG_POST_TAGS)[number];

export const BLOG_POST_TAG_LABELS: Record<BlogPostTag, string> = {
  projects: "Projects",
  thoughts: "Thoughts",
  travel: "Travel",
  other: "Other",
};

export function isBlogPostTag(value: unknown): value is BlogPostTag {
  return BLOG_POST_TAGS.some((tag) => tag === value);
}
