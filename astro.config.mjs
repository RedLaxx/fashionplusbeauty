import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site = process.env.PUBLIC_SITE_URL || 'https://fashionplusbeauty.pages.dev';

export default defineConfig({
  site,
  trailingSlash: 'always',
  output: 'static',
  integrations: [sitemap({ filter: (page) => !page.includes('/search/') })],
  vite: {
    server: {
      // Dev-server host allowlist: permits sandbox/preview proxy hosts such as
      // `4321-abc123.e2b.app`. localhost and plain IP hosts are always allowed by
      // Vite, and this has no effect on the static production build.
      allowedHosts: ['.e2b.app'],
    },
  },
});
