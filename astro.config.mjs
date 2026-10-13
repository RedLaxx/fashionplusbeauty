import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import articleImages from './scripts/satteri-article-images.mjs';

const site = process.env.PUBLIC_SITE_URL || 'https://fashionplusbeauty.pages.dev';

export default defineConfig({
  site,
  trailingSlash: 'always',
  output: 'static',
  integrations: [sitemap({ filter: (page) => !page.includes('/search/') })],
  markdown: {
    // Keep the default Markdown processor, plus one extra hast plugin so images
    // written in article body copy are served from the same responsive WebP
    // pipeline as the rest of the site (see scripts/satteri-article-images.mjs).
    processor: satteri({ hastPlugins: [articleImages] }),
  },
  vite: {
    server: {
      // Dev-server host allowlist: permits sandbox/preview proxy hosts such as
      // `4321-abc123.e2b.app`. localhost and plain IP hosts are always allowed by
      // Vite, and this has no effect on the static production build.
      allowedHosts: ['.e2b.app'],
    },
  },
});
