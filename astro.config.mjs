// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://chsmesh.org',
  integrations: [
    sitemap({
      // The CMS shell is not content.
      filter: (page) => !page.includes('/admin'),
    }),
  ],
  image: {
    // Avoid a hard dependency on the optional `sharp` binary so builds succeed
    // wherever it is unavailable (e.g. the slim Docker build image).
    service: passthroughImageService(),
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Emit hoisted component scripts as external files instead of inlining
      // them, so a strict CSP without `unsafe-inline` can serve the site.
      assetsInlineLimit: 0,
    },
  },
});
