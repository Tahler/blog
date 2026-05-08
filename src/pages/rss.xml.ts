import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE } from "../consts";
import { renderPost } from "../lib/render-post";
import { getSortedPosts } from "../lib/posts";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ site }) => {
  const posts = await getSortedPosts();
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: site || "",
    items: posts.map((post) => ({
      title: post.title,
      description: post.description,
      pubDate: post.date,
      categories: [post.tag],
      link: post.url,
      content: renderPost(post),
    })),
  });
};
