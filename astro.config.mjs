// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { rehypeCanonicalLinks } from './src/utils/rehypeCanonicalLinks.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://chsmesh.org',
  // The build is directory-format, so every page's canonical URL ends in a
  // slash. Declaring it here makes `astro dev` and `astro preview` enforce the
  // same rule nginx does in production, so a slashless internal link surfaces
  // while it is being written rather than as a redirect in production.
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // The CMS shell is not content.
      filter: (page) => !page.includes('/admin'),
    }),
  ],
  markdown: {
    // Internal links in markdown prose bypass resolveLink, so canonicalize
    // them here instead - see src/utils/rehypeCanonicalLinks.mjs.
    rehypePlugins: [rehypeCanonicalLinks],
  },
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
