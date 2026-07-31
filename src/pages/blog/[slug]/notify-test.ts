export const prerender = false;

import type { APIRoute } from "astro";

import { getPost } from "../../../lib/posts";
import {
  InvalidPostRecipientError,
  subscriberService,
} from "../../../lib/subscriber-service";

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

  let recipient: unknown;
  try {
    recipient = (await request.json()).recipient;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (typeof recipient !== "string") {
    return Response.json({ error: "Missing recipient" }, { status: 400 });
  }

  try {
    await subscriberService.sendPostToSubscriber(post, site, recipient);
  } catch (error) {
    if (error instanceof InvalidPostRecipientError) {
      return Response.json(
        { error: "Recipient is not eligible for this post." },
        { status: 400 },
      );
    }

    console.error("Failed to send test post notification", error);
    return Response.json(
      { error: "Unable to send test notification." },
      { status: 502 },
    );
  }

  return Response.json({ title: post.title, sentCount: 1 });
};
