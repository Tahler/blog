import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

import type { Post } from "./posts";

const parser = new MarkdownIt({ html: true });
const contentImageUrls = import.meta.glob<string>(
  "../content/**/*.{jpg,jpeg,png,gif,webp}",
  { eager: true, import: "default", query: "?url" },
);

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function resolveContentImageUrl(post: Post, source: string, site?: URL) {
  if (!post.filePath) {
    return null;
  }

  const directory = post.filePath.slice(0, post.filePath.lastIndexOf("/"));
  const filename = decodeURI(source).replace(/^\.\//, "");
  const key = `../${directory}/${filename}`.replace(/^\.\.\/src\//, "../");
  const url = contentImageUrls[key];
  return url ? (site ? new URL(url, site).toString() : url) : null;
}

function prepareBody(post: Post, site?: URL) {
  return post.body
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(
      /!\[([^\]]*)\]\(\s*(\.[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g,
      (image, alt, source) => {
        const url = resolveContentImageUrl(post, source, site);
        return url
          ? `<img src="${escapeAttribute(url)}" alt="${escapeAttribute(alt)}">`
          : image;
      },
    );
}

export function renderPost(post: Post, site?: URL) {
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

  return sanitizeHtml(parser.render(prepareBody(post, site)), {
    allowedAttributes,
    allowedTags,
  });
}
