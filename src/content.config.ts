import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

import { BLOG_POST_TAGS } from "./lib/blog-post-tags";

const blog = defineCollection({
  loader: glob({
    base: "./src/content/blog",
    pattern: "**/*.md",
    generateId: ({ entry }) =>
      entry.replace(/^\d{4}-\d{2}-\d{2}_/, "").replace(/\.md$/, ""),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    tag: z.enum(BLOG_POST_TAGS),
  }),
});

export const collections = { blog };
