import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

import type { Post } from "./posts";

const parser = new MarkdownIt();

export function renderPost(post: Post) {
  const allowedTags = sanitizeHtml.defaults.allowedTags.concat(["img"]);
  return sanitizeHtml(parser.render(post.body), { allowedTags });
}
