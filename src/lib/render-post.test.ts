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
});
