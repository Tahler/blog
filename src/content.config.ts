import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({
    base: "./src/content/blog",
    pattern: "**/*.{md,mdx}",
    generateId: ({ entry }) =>
      entry
        .replace(/(?:\/index)?\.mdx?$/, "")
        .replace(/^\d{4}-\d{2}-\d{2}_/, ""),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    tag: z.enum(["projects", "thoughts", "other"]),
  }),
});

export const collections = { blog };
