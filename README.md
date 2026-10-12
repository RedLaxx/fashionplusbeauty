# FashionPlusBeauty

An editorial fashion, beauty and lifestyle blog built as a fast, static Astro site. The visual direction is modern glam: warm ivory, cherry-wine accents, confident editorial photography and an approachable, youthful voice for women ages 20–45 in the United States.

**Working tagline:** “For every side of your style.” The text wordmark and tagline are deliberately easy to change in `src/components/SiteHeader.astro` and `src/components/SiteFooter.astro`.

## Run locally

Requires Node.js 22.12 or newer (`.nvmrc` pins the Node 22 line).

```sh
npm install
npm run dev
```

The site is available at `http://localhost:4321`. Check and build it with:

```sh
npm run check
npm run build
npm run preview
```

## Content editing with Pages CMS

The site is static-first and stores articles as Markdown in `src/content/articles/`. The root `.pages.yml` is the Pages CMS configuration.

1. Push the repository to GitHub and open [app.pagescms.org](https://app.pagescms.org); sign in with an account that has access to the repository.
2. Select this repository. Pages CMS reads `.pages.yml` and presents the article collection as an editor.
3. Create or edit a story, choose its section, add descriptive image alt text, and set `status` to `published` only when it is ready.
4. Upload portrait-friendly cover / Pinterest images to the media library. The repository change triggers a new Cloudflare Pages build when GitHub integration is enabled.

Pages CMS commits editorial changes to GitHub, so editors need repository access. There is no CMS database or server to operate. Keep article frontmatter aligned with the collection schema in `src/content.config.ts`.

## Deploy to Cloudflare Pages

Recommended: use GitHub as the source repository and Cloudflare Pages as the static host.

- Framework preset: **Astro**
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: the branch you use for production
- Node version: **22.12 or newer** (or set the Cloudflare `NODE_VERSION` build variable to `22`).

Set `PUBLIC_SITE_URL` in the Cloudflare Pages build environment to the final canonical HTTPS domain. The current canonical domain is `https://fashionplusbeauty.pages.dev`. The sitemap, robots file and canonical metadata use this value.

For local settings, copy `.env.example` to `.env` and edit the values. Never commit credentials or private tokens.

## SEO and Pinterest

- Static, crawlable HTML, descriptive page titles and summaries, canonical URLs, Open Graph / large-image social metadata, BlogPosting JSON-LD, a generated sitemap, and a domain-aware `robots.txt` are included.
- Search results are marked `noindex`; article and category pages are indexable.
- Article pages include a native Pinterest-save link and use the optional portrait `pinImage` field. Use helpful, descriptive alt text and a tall image crop for pins.
- Add your Google Search Console and Pinterest domain-verification token values through `PUBLIC_GOOGLE_SITE_VERIFICATION` and `PUBLIC_PINTEREST_VERIFICATION`.
- SEO setup does not guarantee search ranking or Pinterest distribution. Add the real domain, submit the sitemap, and publish original, accurate editorial content consistently.

## Monetization and launch connections

The build contains prepared AdSense placements, a partner page, article-level affiliate disclosures and a newsletter sign-up design. Third-party accounts are intentionally not fabricated:

- **AdSense:** wait for account/site approval, then set `PUBLIC_ADSENSE_CLIENT_ID` and the relevant `PUBLIC_ADSENSE_SLOT_HOME`, `PUBLIC_ADSENSE_SLOT_ARTICLE`, and `PUBLIC_ADSENSE_SLOT_FOOTER` values. Slots appear only when configured in a production build; local development shows a subtle placement preview. AdSense approval and earnings are not guaranteed.
- **Affiliate links:** add real tracked links only after joining a program. Mark the article's `affiliateDisclosure` field and include a clear, nearby notice in the story. Update `/affiliate-disclosure/` for the actual programs and applicable rules.
- **Newsletter:** the form is currently a non-collecting design preview. Connect a provider (for example, Kit, Mailchimp or Buttondown) before asking readers to sign up; do not treat the preview as a live subscription form.
- **Contact:** set up and verify `hello@fashionplusbeauty.com`, or replace it across `/contact/`, `/partner/`, `/privacy/` and `/about/` before launch.
- **Legal:** `/privacy/`, `/terms/` and `/affiliate-disclosure/` are starter copy. Review them for the services, jurisdiction and ad/analytics setup you actually use.

## Project map

```text
src/content/articles/       Markdown stories and frontmatter
src/pages/                  Home, category archives, articles and information pages
src/components/             Header, footer, story cards, newsletter and ad slots
src/styles/global.css       Responsive design system and layout styles
.pages.yml                  Pages CMS collection and media configuration
public/images/              Original editorial image assets
```
