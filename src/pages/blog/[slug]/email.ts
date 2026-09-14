export const prerender = false;

import type { APIRoute } from "astro";

import { getPost } from "../../../lib/posts";
import { renderPost } from "../../../lib/render-post";

export const GET: APIRoute = async ({ params, request }) => {
  if (!import.meta.env.DEV) {
    return new Response("Not found", { status: 404 });
  }

  const slug = params.slug;
  if (!slug) {
    return new Response("Missing slug", { status: 400 });
  }

  const post = await getPost(slug);
  if (!post) {
    return new Response("Post not found", { status: 404 });
  }

  return new Response(renderPost(post, new URL(request.url)), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};
