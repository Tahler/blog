// @ts-check

import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://bertyl.com",
  adapter: vercel(),
  markdown: {
    smartypants: { dashes: "oldschool" },
  },
  image: {
    layout: "constrained",
  },
  integrations: [sitemap()],
});
