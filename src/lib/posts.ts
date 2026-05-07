import { getCollection, getEntry, type CollectionEntry } from "astro:content";

type BlogEntry = CollectionEntry<"blog">;

export type Post = BlogEntry & {
  slug: string;
  url: string;
};

export async function getSortedPosts(): Promise<Post[]> {
  const entries = await getCollection("blog");
  return entries
    .slice()
    .sort(
      (a, b) =>
        new Date(b.data.date).getTime() - new Date(a.data.date).getTime(),
    )
    .map(toPost);
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const entry = await getEntry("blog", slug);
  return entry ? toPost(entry) : null;
}

function toPost(entry: BlogEntry): Post {
  const slug = entry.id;
  return {
    ...entry,
    slug,
    url: `/blog/${slug}/`,
  };
}
