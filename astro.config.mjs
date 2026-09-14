// @ts-check

import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://bertyl.com",
  adapter: vercel(),
  image: {
    layout: "constrained",
  },
  integrations: [sitemap()],
});
