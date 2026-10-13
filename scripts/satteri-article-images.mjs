/**
 * Sätteri hast plugin: serve Markdown body images from the responsive WebP pipeline.
 *
 * `scripts/generate-images.mjs` encodes WebP variants for every photo in
 * `public/images/`, but a Markdown image inside an article — `![Alt](/images/photo.jpg)`
 * — would otherwise be emitted as a plain `<img>` pointing at the original JPEG.
 * Astro only maps Markdown images to components in MDX, so this plugin upgrades
 * them at build time from the generated manifest, producing the same markup as
 * `src/components/ResponsivePicture.astro`:
 *
 *   <figure class="article-inline-figure">
 *     <picture class="responsive-picture">
 *       <img src="/images/generated/photo-<hash>-480.webp"
 *            srcset="/images/generated/photo-<hash>-320.webp 320w, …"
 *            sizes="…" width="1024" height="1536" loading="lazy" decoding="async">
 *     </picture>
 *   </figure>
 *
 * The `<figure>` wrapper — styled by `.article-inline-figure` in global.css — is only
 * added when the image stands alone in its own paragraph, which is how article
 * bodies are written. An image used mid-sentence is simply swapped for the
 * `<picture>`, so it stays inline. Images authored directly in raw HTML (such as
 * `<figure class="article-inline-figure">…<figcaption>…</figcaption></figure>` or
 * HTML written by the Pages CMS rich-text editor) have their `<img>` tags upgraded
 * in place, leaving surrounding `<figure>`, `<figcaption>` and any extra attributes
 * untouched.
 *
 * Two deliberate differences from the component:
 *   - No 3:2 "compact" mobile `<source>`: editorial body images such as the
 *     portrait infographics must keep their own aspect ratio on phones.
 *   - `sizes` follows the article column: full width, minus the page margins and,
 *     above 800px, the sidebar.
 *
 * There is no type-only import from `satteri` here on purpose: the plugin is a
 * plain definition object, so registering it (see astro.config.mjs) does not load
 * the native module any earlier than the processor already does.
 *
 * Graceful degradation matches the rest of the pipeline: without a manifest (a
 * fresh clone, or a machine where Sharp could not be installed) every image is
 * left exactly as authored, so `astro check` and clean builds keep working.
 * The manifest is read once per process, so restart the dev server after adding
 * a new image to `public/images/`.
 */
import { readFileSync } from 'node:fs';

const MANIFEST_PATH = 'public/images/generated/manifest.json';

/** Width of the article column at each layout step (see `.article-layout` in global.css). */
const DEFAULT_SIZES =
  '(max-width: 540px) calc(100vw - 38px), (max-width: 800px) calc(100vw - 40px), (max-width: 1094px) calc(100vw - 326px), 720px';

const FIGURE_CLASS = 'article-inline-figure';

function loadManifest() {
  try {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    return manifest?.images && typeof manifest.images === 'object' ? manifest.images : {};
  } catch {
    return {};
  }
}

/** Matches the lookup key used by `src/lib/responsive-images.ts`. */
function normalizePath(src) {
  return src.startsWith('/') ? src : `/${src}`;
}

function isRemote(src) {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(src) || src.startsWith('data:');
}

function isElement(node, tagName) {
  return node?.type === 'element' && node.tagName === tagName;
}

/** The `<picture>` for one Markdown image, or `undefined` to leave it as authored. */
function buildPicture(node, images) {
  const src = typeof node.properties?.src === 'string' ? node.properties.src : undefined;
  if (!src || isRemote(src)) return undefined;

  const entry = images[normalizePath(src)];
  const variants = entry?.main?.variants ?? [];
  if (variants.length === 0) return undefined;

  const narrowest = variants[0];
  const widest = variants[variants.length - 1];
  const authoredSizes = typeof node.properties?.sizes === 'string' ? node.properties.sizes : undefined;

  return {
    type: 'element',
    tagName: 'picture',
    properties: { className: ['responsive-picture'] },
    children: [
      {
        type: 'element',
        tagName: 'img',
        properties: {
          src: narrowest.path,
          srcSet: variants.map((variant) => `${variant.path} ${variant.width}w`).join(', '),
          sizes: authoredSizes ?? DEFAULT_SIZES,
          width: entry.source?.width ?? widest.width,
          height: entry.source?.height ?? widest.height,
          alt: typeof node.properties?.alt === 'string' ? node.properties.alt : '',
          loading: 'lazy',
          decoding: 'async',
        },
        children: [],
      },
    ],
  };
}

/** True when the paragraph holds nothing but the image (whitespace aside). */
function holdsOnlyImage(paragraph) {
  const meaningful = (paragraph.children ?? []).filter(
    (child) => child.type === 'element' || (child.type === 'text' && child.value.trim() !== ''),
  );
  return meaningful.length === 1 && isElement(meaningful[0], 'img');
}

const IMG_TAG_RE = /<img\b((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/gi;
const ATTR_RE = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const MANAGED_ATTRS = new Set(['src', 'srcset', 'sizes', 'width', 'height', 'alt', 'loading', 'decoding']);

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Upgrades `<img>` tags inside a raw HTML block in place, leaving `<figure>` and `<figcaption>` untouched. */
function rewriteRawImages(html, images) {
  if (typeof html !== 'string' || !/<img\b/i.test(html) || /<picture\b/i.test(html)) {
    return undefined;
  }

  let changed = false;
  const rewritten = html.replace(IMG_TAG_RE, (fullTag, attrText) => {
    const attrs = new Map();
    const extras = [];

    for (const match of attrText.matchAll(ATTR_RE)) {
      const rawName = match[1];
      const name = rawName.toLowerCase();
      const value = match[2] ?? match[3] ?? match[4] ?? '';
      const hasValue = match[2] !== undefined || match[3] !== undefined || match[4] !== undefined;
      attrs.set(name, hasValue ? value : true);
      if (!MANAGED_ATTRS.has(name)) {
        extras.push(hasValue ? `${rawName}="${escapeAttr(value)}"` : rawName);
      }
    }

    if (attrs.has('srcset')) return fullTag;
    const src = attrs.get('src');
    if (typeof src !== 'string' || !src || isRemote(src)) return fullTag;

    const entry = images[normalizePath(src)];
    const variants = entry?.main?.variants ?? [];
    if (variants.length === 0) return fullTag;

    const narrowest = variants[0];
    const widest = variants[variants.length - 1];
    const srcset = variants.map((variant) => `${variant.path} ${variant.width}w`).join(', ');
    const authoredSizes = attrs.get('sizes');
    const sizes = typeof authoredSizes === 'string' && authoredSizes ? authoredSizes : DEFAULT_SIZES;
    const width = entry.source?.width ?? widest.width;
    const height = entry.source?.height ?? widest.height;
    const alt = typeof attrs.get('alt') === 'string' ? attrs.get('alt') : '';
    const authoredLoading = attrs.get('loading');
    const loading = typeof authoredLoading === 'string' && authoredLoading ? authoredLoading : 'lazy';
    const authoredDecoding = attrs.get('decoding');
    const decoding = typeof authoredDecoding === 'string' && authoredDecoding ? authoredDecoding : 'async';
    const extraAttrText = extras.length > 0 ? ` ${extras.join(' ')}` : '';

    changed = true;
    return `<picture class="responsive-picture"><img src="${escapeAttr(narrowest.path)}" srcset="${escapeAttr(srcset)}" sizes="${escapeAttr(sizes)}" width="${width}" height="${height}" alt="${escapeAttr(alt)}" loading="${escapeAttr(loading)}" decoding="${escapeAttr(decoding)}"${extraAttrText}></picture>`;
  });

  return changed ? rewritten : undefined;
}

const articleImages = {
  name: 'article-responsive-images',
  element: {
    filter: ['img'],
    visit(node, ctx) {
      const picture = buildPicture(node, loadManifest());
      if (!picture) return;

      const parent = ctx.parent(node);
      if (parent && isElement(parent, 'p') && holdsOnlyImage(parent)) {
        ctx.replaceNode(parent, {
          type: 'element',
          tagName: 'figure',
          properties: { className: [FIGURE_CLASS] },
          children: [picture],
        });
        return;
      }

      return picture;
    },
  },
  raw(node) {
    const rewritten = rewriteRawImages(node.value, loadManifest());
    if (!rewritten) return;
    return { type: 'raw', value: rewritten };
  },
};

export default articleImages;
