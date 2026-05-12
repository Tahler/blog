export const prerender = false;

import type { APIRoute } from "astro";

import { getPost } from "../../../lib/posts";
import { subscriberService } from "../../../lib/subscriber-service";

export const POST: APIRoute = async ({ params, request, site }) => {
  const secret = import.meta.env.NOTIFY_API_SECRET;
  if (!secret) {
    return Response.json(
      { error: "Server is not configured for notifications." },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = params.slug;
  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  const post = await getPost(slug);
  if (!post) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  if (!site) {
    return Response.json(
      { error: "Site URL is unavailable." },
      { status: 500 },
    );
  }

  const result = await subscriberService.sendPost(post, site);
  return Response.json({
    title: result.post.title,
    subscriberCount: result.subscriberCount,
    sentCount: result.sentCount,
    errorsByEmail: result.errorsByEmail,
  });
};
