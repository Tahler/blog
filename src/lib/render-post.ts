import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

import type { Post } from "./posts";

const parser = new MarkdownIt({ html: true });
const responsiveImageStyle = "display:block;max-width:100%;height:auto";
const galleryImageStyle = "display:block;width:100%;max-width:100%;height:auto";
const contentImageUrls = import.meta.glob<string>(
  "../content/**/*.{jpg,jpeg,png,gif,webp}",
  { eager: true, import: "default", query: "?url" },
);

export function renderPost(post: Post, site?: URL) {
  const allowedTags = sanitizeHtml.defaults.allowedTags.concat([
    "img",
    "source",
    "video",
  ]);
  const allowedAttributes = {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: [...(sanitizeHtml.defaults.allowedAttributes.img || []), "style"],
    source: ["src", "type"],
    table: ["border", "cellpadding", "cellspacing", "role", "width"],
    td: ["valign", "width"],
    video: ["aria-label", "controls", "muted", "playsinline", "preload"],
  };

  const renderedHtml = parser.render(prepareBody(post, site));
  return sanitizeHtml(prepareGalleries(renderedHtml), {
    allowedAttributes,
    allowedStyles: {
      img: {
        display: [/^block$/],
        width: [/^100%$/],
        "max-width": [/^100%$/],
        height: [/^auto$/],
      },
    },
    allowedTags,
    transformTags: {
      img: (tagName, attribs) => {
        const galleryImage = attribs["data-gallery-image"] === "true";
        delete attribs["data-gallery-image"];
        return {
          tagName,
          attribs: {
            ...attribs,
            ...(galleryImage ? { width: "100%" } : {}),
            style: galleryImage ? galleryImageStyle : responsiveImageStyle,
          },
        };
      },
    },
  });
}

function prepareGalleries(html: string) {
  return html.replace(
    /<figure class="gallery"[^>]*>\s*<div class="column">([\s\S]*?)<\/div>\s*<div class="column">([\s\S]*?)<\/div>\s*<\/figure>/g,
    (_gallery, firstColumn, secondColumn) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="8" border="0">
        <tbody>
          <tr>
            <td width="50%" valign="top">${prepareGalleryColumn(firstColumn)}</td>
            <td width="50%" valign="top">${prepareGalleryColumn(secondColumn)}</td>
          </tr>
        </tbody>
      </table>
    `,
  );
}

function prepareGalleryColumn(html: string) {
  return html.replaceAll("<img ", '<img data-gallery-image="true" ');
}

function prepareBody(post: Post, site?: URL) {
  return post.body.replace(
    /!\[([^\]]*)\]\(\s*(\.[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g,
    (image, alt, source) => {
      const url = resolveContentImageUrl(post, source, site);
      return url
        ? `<img src="${escapeAttribute(url)}" alt="${escapeAttribute(alt)}">`
        : image;
    },
  );
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

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
