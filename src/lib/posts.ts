import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

type BlogEntry = CollectionEntry<"blog">;

export type Post = BlogEntry & {
  slug: string;
  url: string;
};

export async function getSortedPosts(): Promise<Post[]> {
  const posts = await getCollection("blog");

  return posts
    .slice()
    .sort(
      (a, b) =>
        new Date(b.data.date).getTime() - new Date(a.data.date).getTime(),
    )
    .map(toPost);
}

function toPost(post: BlogEntry): Post {
  const match = post.id.match(/^\d{4}-\d{2}-\d{2}_(.+)$/);
  const slug = match ? match[1] : post.id;

  return {
    ...post,
    slug,
    url: `/blog/${slug}/`,
  };
}
