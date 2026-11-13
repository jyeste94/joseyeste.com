import { defineConfig } from 'astro/config'
import tailwind from "@astrojs/tailwind"
import robotsTxt from "astro-robots-txt"
import sitemap from "@astrojs/sitemap"
import rehypeDotnetStudy from "./src/plugins/rehype-dotnet-study.mjs"

// https://astro.build/config
export default defineConfig({
  site: 'https://joseyeste.com',
  markdown: { rehypePlugins: [rehypeDotnetStudy] },
  integrations: [
    tailwind(),
    sitemap(),
    robotsTxt()
  ]
})
