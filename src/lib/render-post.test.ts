import { describe, expect, it } from "vitest";

import type { Post } from "./posts";
import { renderPost } from "./render-post";

const post: Post = {
  url: "/blog/test/",
  title: "Test",
  description: "Test post",
  date: "2026-09-13",
  tag: "other",
  body: "",
};

describe("renderPost", () => {
  it("renders galleries as two email-safe columns", () => {
    const html = renderPost({
      ...post,
      body: `
<figure class="gallery" aria-label="Gallery">

<div class="column">

![First](https://example.com/first.jpg)

</div>

<div class="column">

![Second](https://example.com/second.jpg)

</div>

</figure>
      `,
    });

    expect(html).toContain(
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="8" border="0">',
    );
    expect(html).toContain('<td width="50%" valign="top">');
    expect(html).toContain(
      '<img src="https://example.com/first.jpg" alt="First" width="100%" style="display:block;width:100%;max-width:100%;height:auto;margin-bottom:8px" />',
    );
    expect(html).not.toContain('<figure class="gallery"');
  });

  it("keeps ordinary images responsive without upscaling them", () => {
    const html = renderPost({
      ...post,
      body: "![Alt text](https://example.com/photo.jpg)",
    });

    expect(html).toContain(
      '<img src="https://example.com/photo.jpg" alt="Alt text" style="display:block;max-width:100%;height:auto" />',
    );
    expect(html).not.toContain('width="100%"');
  });

  it("renders footnotes as styled, linked endnotes", () => {
    const html = renderPost({
      ...post,
      body: [
        "A statement with a footnote.[^detail]",
        "",
        "[^detail]: Supporting detail with a [link](https://example.com).",
      ].join("\n"),
    });

    expect(html).toContain(
      '<sup style="font-size:0.75em;line-height:0;vertical-align:super"><a href="#fn-blog-test-1" id="fnref-blog-test-1" style="color:#555;text-decoration:none;font-weight:600">1</a></sup>',
    );
    expect(html).toContain(
      '<section aria-label="Footnotes" style="color:#555;font-size:0.875em;line-height:1.5">',
    );
    expect(html).toContain(
      '<ol style="list-style:none;margin:0;padding-left:0">',
    );
    expect(html).toContain(
      '<li id="fn-blog-test-1" style="margin-bottom:8px"><p><a href="#fnref-blog-test-1" aria-label="Back to footnote reference 1" style="text-decoration:underline;margin-right:4px">1</a> Supporting detail',
    );
    expect(html).toContain(
      '<a href="#fnref-blog-test-1" aria-label="Back to footnote reference" style="color:#555;text-decoration:none">↩︎</a>',
    );
    expect(html).toContain('<a href="https://example.com">link</a>');
    expect(html).not.toContain("[^detail]");
  });
});
