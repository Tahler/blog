import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

import type { Post } from "./posts";

const parser = new MarkdownIt({ html: true });

export function renderPost(post: Post) {
  const allowedTags = sanitizeHtml.defaults.allowedTags.concat([
    "img",
    "source",
    "video",
  ]);
  const allowedAttributes = {
    ...sanitizeHtml.defaults.allowedAttributes,
    source: ["src", "type"],
    video: ["aria-label", "controls", "muted", "playsinline", "preload"],
  };

  return sanitizeHtml(parser.render(post.body), { allowedAttributes, allowedTags });
}
