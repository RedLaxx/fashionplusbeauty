#!/usr/bin/env node
/**
 * Responsive image pipeline for FashionPlusBeauty.
 *
 * Encodes WebP variants for every raster image in `public/images` and writes a
 * manifest that the site reads at build time (see src/lib/responsive-images.ts).
 *
 * Two sets of variants are produced per image:
 *   - `main`   – full-frame variants used everywhere by default.
 *   - `mobile` – 3:2 "compact card" crops served to phones (<= 540px) so the
 *                mobile layout downloads fewer pixels and gets a shorter card.
 *
 * Usage:
 *   node scripts/generate-images.mjs [--force] [--quiet]
 *
 * Runs automatically before `npm run dev` and `npm run build` (pre-scripts).
 * Output: public/images/generated/ — git-ignored, rebuilt on every build.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

const { values: flags } = parseArgs({
  options: {
    force: { type: 'boolean', default: false },
    quiet: { type: 'boolean', default: false },
  },
});

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, 'public', 'images');
const OUTPUT_DIR = path.join(SOURCE_DIR, 'generated');
const MANIFEST_FILE = path.join(OUTPUT_DIR, 'manifest.json');

const MANIFEST_VERSION = 1;
const QUALITY = 72;
const MOBILE_MEDIA = '(max-width: 540px)';
const MOBILE_ASPECT = 3 / 2;
const MAIN_WIDTHS = [320, 480, 640, 900, 1200, 1600];
const MOBILE_WIDTHS = [360, 540, 720, 960, 1080];
const SOURCE_PATTERN = /\.(jpe?g|png|webp|avif)$/i;
const MAX_PARALLEL_ENCODES = 4;

const log = (...args) => {
  if (!flags.quiet) console.log(...args);
};
const warn = (...args) => console.warn(...args);

/** Sharp is an optional-at-runtime dependency: the site must still build without it. */
async function loadSharp() {
  try {
    const module = await import('sharp');
    return module.default ?? module;
  } catch (error) {
    return { error };
  }
}

/**
 * Variant names carry a short source fingerprint. `/images/*` is served with a
 * one-year `immutable` Cache-Control header (`public/_headers`), so replacing a
 * photo without changing its filename must still produce new URLs.
 */
function variantFileName(base, width, kind, hash) {
  return kind === 'mobile'
    ? `${base}-${hash}-mobile-${width}.webp`
    : `${base}-${hash}-${width}.webp`;
}

function sourceHash(fileStats) {
  return createHash('sha1')
    .update(`${fileStats.size}:${Math.round(fileStats.mtimeMs)}`)
    .digest('hex')
    .slice(0, 8);
}

function buildWidthPlan(sourceWidth, widths, { capAtSource = true } = {}) {
  const plan = widths.filter((width) => width <= sourceWidth);
  const largest = plan.at(-1);
  // `capAtSource` keeps a full-resolution variant for non-upscaled sources. Phone
  // variants skip it: a <= 540px viewport never needs the original pixel width.
  if (capAtSource && sourceWidth > (largest ?? 0)) plan.push(sourceWidth);
  if (plan.length === 0) plan.push(sourceWidth);
  return plan;
}

function createPool(limit) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= limit || queue.length === 0) return;
    active += 1;
    const { task, resolve, reject } = queue.shift();
    task().then(
      (value) => {
        active -= 1;
        resolve(value);
        next();
      },
      (error) => {
        active -= 1;
        reject(error);
        next();
      },
    );
  };
  return {
    run(task) {
      return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        next();
      });
    },
  };
}

function toWebPath(...segments) {
  return `/${segments.join('/')}`;
}

async function encodeVariant(sharp, file, width, kind) {
  const pipeline = sharp(file).rotate();
  if (kind === 'mobile') {
    const height = Math.round(width / MOBILE_ASPECT);
    return pipeline
      .resize({ width, height, fit: 'cover', position: 'attention', withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 4 })
      .toBuffer();
  }
  return pipeline.resize({ width, withoutEnlargement: true }).webp({ quality: QUALITY, effort: 4 }).toBuffer();
}

async function processImage({ sharp, file, fileName, previous, pool }) {
  const sourceStats = await stat(file);
  const metadata = await sharp(file).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('could not read intrinsic dimensions');
  }

  const base = fileName.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const source = {
    bytes: sourceStats.size,
    hash: sourceHash(sourceStats),
    height: metadata.height,
    mtimeMs: Math.round(sourceStats.mtimeMs),
    width: metadata.width,
  };
  const webPath = toWebPath('images', fileName);

  const plan = {
    main: buildWidthPlan(source.width, MAIN_WIDTHS),
    mobile: buildWidthPlan(source.width, MOBILE_WIDTHS, { capAtSource: false }),
  };

  const sourceUnchanged =
    previous?.source?.bytes === source.bytes &&
    previous?.source?.mtimeMs === source.mtimeMs &&
    previous?.source?.hash === source.hash &&
    previous?.quality === QUALITY &&
    previous?.source?.width === source.width &&
    previous?.source?.height === source.height;

  if (sourceUnchanged && !flags.force) {
    const expectedFiles = [
      ...plan.main.map((width) => variantFileName(base, width, 'main', source.hash)),
      ...plan.mobile.map((width) => variantFileName(base, width, 'mobile', source.hash)),
    ];
    const existing = new Set(await readdir(OUTPUT_DIR).catch(() => []));
    if (expectedFiles.every((name) => existing.has(name))) {
      return { entry: previous, reused: true, written: [] };
    }
  }

  const written = [];
  const encodeAll = async (widths, kind) => {
    const variants = await Promise.all(
      widths.map((width) =>
        pool.run(async () => {
          const buffer = await encodeVariant(sharp, file, width, kind);
          const name = variantFileName(base, width, kind, source.hash);
          await writeFile(path.join(OUTPUT_DIR, name), buffer);
          const info = await sharp(buffer).metadata();
          written.push(name);
          return {
            bytes: buffer.length,
            height: info.height,
            path: toWebPath('images', 'generated', name),
            width: info.width,
          };
        }),
      ),
    );
    return variants;
  };

  const mainVariants = await encodeAll(plan.main, 'main');
  const mobileVariants = await encodeAll(plan.mobile, 'mobile');
  const mainLargest = mainVariants.at(-1);
  const mobileLargest = mobileVariants.at(-1);

  return {
    entry: {
      src: webPath,
      source,
      quality: QUALITY,
      main: {
        height: mainLargest?.height ?? source.height,
        variants: mainVariants,
        width: mainLargest?.width ?? source.width,
      },
      mobile: {
        aspect: MOBILE_ASPECT,
        height: mobileLargest?.height ?? Math.round(source.width / MOBILE_ASPECT),
        media: MOBILE_MEDIA,
        variants: mobileVariants,
        width: mobileLargest?.width ?? source.width,
      },
    },
    reused: false,
    written,
    base,
  };
}

async function main() {
  const sharp = await loadSharp();

  if (sharp.error) {
    const message = `responsive images skipped: "sharp" is unavailable (${sharp.error.message})`;
    if (process.env.CI) {
      warn(`✖ ${message}`);
      warn('  CI builds must ship optimized images — run `npm ci` so sharp is installed.');
      process.exitCode = 1;
      return;
    }
    warn(`⚠ ${message}`);
    warn('  The site will fall back to the original JPEG/PNG files. Run `npm install` to fix.');
    return;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  let previousManifest = { images: {} };
  try {
    previousManifest = JSON.parse(await readFile(MANIFEST_FILE, 'utf8'));
  } catch {
    // no previous manifest – everything is generated from scratch
  }

  const files = (await readdir(SOURCE_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && SOURCE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (files.length === 0) {
    warn('⚠ no raster images found in public/images – nothing to generate');
    return;
  }

  const pool = createPool(MAX_PARALLEL_ENCODES);
  const images = {};
  const keep = new Set(['manifest.json']);
  const failures = [];
  let reusedCount = 0;
  let generatedCount = 0;
  let totalBytes = 0;

  for (const fileName of files) {
    try {
      const result = await processImage({
        sharp: sharp,
        file: path.join(SOURCE_DIR, fileName),
        fileName,
        previous: previousManifest.images?.[toWebPath('images', fileName)],
        pool,
      });
      images[result.entry.src] = result.entry;
      for (const name of result.written) keep.add(name);
      if (result.reused) {
        reusedCount += 1;
        for (const variant of [...result.entry.main.variants, ...result.entry.mobile.variants]) {
          keep.add(path.basename(variant.path));
        }
      } else {
        generatedCount += 1;
      }
      totalBytes += [...result.entry.main.variants, ...result.entry.mobile.variants].reduce(
        (sum, variant) => sum + variant.bytes,
        0,
      );
    } catch (error) {
      failures.push(`${fileName}: ${error.message}`);
    }
  }

  // Drop variants that are no longer referenced (renamed or removed sources).
  const existingFiles = await readdir(OUTPUT_DIR);
  let pruned = 0;
  for (const name of existingFiles) {
    if (keep.has(name)) continue;
    await unlink(path.join(OUTPUT_DIR, name));
    pruned += 1;
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/generate-images.mjs',
    images,
    mobileAspect: MOBILE_ASPECT,
    mobileMedia: MOBILE_MEDIA,
    quality: QUALITY,
    version: MANIFEST_VERSION,
  };
  await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);

  const variantCount = Object.values(images).reduce(
    (sum, entry) => sum + entry.main.variants.length + entry.mobile.variants.length,
    0,
  );
  log(
    `responsive images: ${variantCount} WebP variants for ${Object.keys(images).length} image(s) ` +
      `(${generatedCount} generated, ${reusedCount} reused, ${pruned} pruned, ${(totalBytes / 1024).toFixed(0)} KB)`,
  );

  if (failures.length > 0) {
    for (const failure of failures) warn(`✖ ${failure}`);
    process.exitCode = 1;
  }
}

await main();
