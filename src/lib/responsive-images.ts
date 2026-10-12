/**
 * Build-time reader for the responsive image manifest produced by
 * `scripts/generate-images.mjs` (run via `npm run images`, or automatically by
 * the `predev` / `prebuild` scripts).
 *
 * The manifest and its WebP variants live in `public/images/generated/`, which is
 * git-ignored and rebuilt on every build. When the manifest is missing — a fresh
 * clone running `astro check`, or a machine where sharp could not be installed —
 * every lookup returns `undefined` and callers fall back to the original image
 * file, so the site never emits a broken `srcset`.
 */

export interface ImageVariant {
  bytes: number;
  height: number;
  path: string;
  width: number;
}

export interface ResponsiveImageEntry {
  src: string;
  source: { bytes: number; height: number; mtimeMs: number; width: number };
  quality: number;
  main: { height: number; variants: ImageVariant[]; width: number };
  mobile: {
    aspect: number;
    height: number;
    media: string;
    variants: ImageVariant[];
    width: number;
  };
}

interface ImageManifest {
  version: number;
  quality: number;
  mobileMedia: string;
  mobileAspect: number;
  images: Record<string, ResponsiveImageEntry>;
}

const manifestModules = import.meta.glob<{ default: ImageManifest }>(
  '/public/images/generated/manifest.json',
  { eager: true },
);

const manifest: ImageManifest | undefined = Object.values(manifestModules)[0]?.default;

/** Normalizes `images/foo.jpg`, `/images/foo.jpg` and absolute URLs for lookups. */
function normalizePath(src: string) {
  return src.startsWith('/') ? src : `/${src}`;
}

/** Looks up the generated variants for a `/images/...` path. Remote URLs return undefined. */
export function getResponsiveImage(src?: string): ResponsiveImageEntry | undefined {
  if (!src || /^(?:https?:)?\/\//i.test(src)) return undefined;
  return manifest?.images[normalizePath(src)];
}

/** Builds a `srcset` string such as `/images/generated/x-320.webp 320w, ...`. */
export function srcSetFor(variants: ImageVariant[]) {
  return variants.map((variant) => `${variant.path} ${variant.width}w`).join(', ');
}

/** Smallest variant — used as the plain `src` for browsers that ignore `srcset`. */
export function fallbackSrcFor(entry: ResponsiveImageEntry) {
  return entry.main.variants[0]?.path ?? entry.src;
}

/** Intrinsic aspect ratio of the full-frame variants, for layout hints. */
export function aspectRatioFor(entry: ResponsiveImageEntry) {
  return entry.main.height > 0 ? entry.main.width / entry.main.height : 1;
}
