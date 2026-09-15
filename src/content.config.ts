import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({
    base: "./src/content/blog",
    pattern: "**/*.md",
    generateId: ({ entry }) =>
      entry.replace(/(?:\/index)?\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}_/, ""),
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      tag: z.enum(["projects", "thoughts", "other"]),
      image: image().optional(),
      imageAlt: z.string().optional(),
    }),
});

export const collections = { blog };
