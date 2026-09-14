import MarkdownIt from "markdown-it";
import markdownItFootnote from "markdown-it-footnote";
import sanitizeHtml from "sanitize-html";

import type { Post } from "./posts";

const parser = new MarkdownIt({ html: true }).use(markdownItFootnote);
const responsiveImageStyle = "display:block;max-width:100%;height:auto";
const galleryImageStyle =
  "display:block;width:100%;max-width:100%;height:auto;margin-bottom:8px";
const footnoteReferenceStyle =
  "font-size:0.75em;line-height:0;vertical-align:super";
const footnoteReferenceLinkStyle =
  "color:#555;text-decoration:none;font-weight:600";
const footnoteSeparatorStyle =
  "border:0;border-top:1px solid #ddd;margin:32px 0 16px";
const footnoteSectionStyle = "color:#555;font-size:0.875em;line-height:1.5";
const footnoteListStyle = "list-style:none;margin:0;padding-left:0";
const footnoteItemStyle = "margin-bottom:8px";
const footnoteNumberStyle =
  "color:#555;text-decoration:underline dashed;margin-right:4px";
const footnoteBackrefStyle = "color:#555;text-decoration:none";
const contentImageUrls = import.meta.glob<string>(
  "../content/**/*.{jpg,jpeg,png,gif,webp}",
  { eager: true, import: "default", query: "?url" },
);

export function renderPost(post: Post, site?: URL) {
  const allowedTags = sanitizeHtml.defaults.allowedTags.concat([
    "img",
    "section",
    "source",
    "video",
  ]);
  const allowedAttributes = {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: [
      ...(sanitizeHtml.defaults.allowedAttributes.a || []),
      "aria-label",
      "id",
      "style",
    ],
    hr: ["style"],
    img: [...(sanitizeHtml.defaults.allowedAttributes.img || []), "style"],
    li: ["id", "style"],
    ol: ["style"],
    section: ["aria-label", "style"],
    source: ["src", "type"],
    sup: ["style"],
    table: ["border", "cellpadding", "cellspacing", "role", "width"],
    td: ["valign", "width"],
    video: ["aria-label", "controls", "muted", "playsinline", "preload"],
  };

  const documentId =
    post.url.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "post";
  const renderedHtml = parser.render(prepareBody(post, site), {
    docId: documentId,
  });
  return sanitizeHtml(prepareFootnotes(prepareGalleries(renderedHtml)), {
    allowedAttributes,
    allowedStyles: {
      a: {
        color: [/^#555$/],
        "font-weight": [/^600$/],
        "margin-right": [/^4px$/],
        "text-decoration": [/^(none|underline dashed)$/],
      },
      hr: {
        border: [/^0$/],
        "border-top": [/^1px solid #ddd$/],
        margin: [/^32px 0 16px$/],
      },
      img: {
        display: [/^block$/],
        width: [/^100%$/],
        "max-width": [/^100%$/],
        height: [/^auto$/],
        "margin-bottom": [/^8px$/],
      },
      li: {
        "margin-bottom": [/^8px$/],
      },
      ol: {
        "list-style": [/^none$/],
        margin: [/^0$/],
        "padding-left": [/^0$/],
      },
      section: {
        color: [/^#555$/],
        "font-size": [/^0\.875em$/],
        "line-height": [/^1\.5$/],
      },
      sup: {
        "font-size": [/^0\.75em$/],
        "line-height": [/^0$/],
        "vertical-align": [/^super$/],
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

function prepareFootnotes(html: string) {
  return html
    .replaceAll(
      '<sup class="footnote-ref">',
      `<sup style="${footnoteReferenceStyle}">`,
    )
    .replace(
      /<a href="(#fn[^"]*)" id="([^"]*)">/g,
      `<a href="$1" id="$2" style="${footnoteReferenceLinkStyle}">`,
    )
    .replaceAll(
      '<hr class="footnotes-sep">',
      `<hr style="${footnoteSeparatorStyle}">`,
    )
    .replaceAll(
      '<section class="footnotes">',
      `<section aria-label="Footnotes" style="${footnoteSectionStyle}">`,
    )
    .replaceAll(
      '<ol class="footnotes-list">',
      `<ol style="${footnoteListStyle}">`,
    )
    .replace(
      /<li id="fn([^"]*)" class="footnote-item"><p>/g,
      (_item, id: string) => {
        const number = id.match(/(\d+)$/)?.[1] || "";
        const numberLink = `<a href="#fnref${id}" aria-label="Back to footnote reference ${number}" style="${footnoteNumberStyle}">${number}</a>`;
        return `<li id="fn${id}" style="${footnoteItemStyle}"><p>${numberLink} `;
      },
    )
    .replace(
      /<a href="(#fnref[^"]*)" class="footnote-backref">/g,
      `<a href="$1" aria-label="Back to footnote reference" style="${footnoteBackrefStyle}">`,
    );
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
