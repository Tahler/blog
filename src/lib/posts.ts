import { getCollection, getEntry, type CollectionEntry } from "astro:content";

type BlogEntry = CollectionEntry<"blog">;

function toPost(entry: BlogEntry): Post {
  return {
    ...entry.data,
    date: new Date(entry.data.date),
    url: `/blog/${entry.id}/`,
  };
}

export interface Post {
  url: string;
  title: string;
  description: string;
  date: Date;
  tag: BlogEntry["data"]["tag"];
}

export async function getSortedPosts(): Promise<Post[]> {
  const entries = await getCollection("blog");
  return entries
    .sort(
      (a, b) =>
        new Date(b.data.date).getTime() - new Date(a.data.date).getTime(),
    )
    .map(toPost);
}

export async function getPost(slug: string): Promise<Post | null> {
  const entry = await getEntry("blog", slug);
  if (!entry) {
    return null;
  }
  return toPost(entry);
}
