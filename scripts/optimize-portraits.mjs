import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Original artwork is read-only. Preserve the full canvas, including transparent
// margins, so both outputs retain the existing layout and crop coordinates.
const root = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = 'src/assets/portraits-runtime';
const manifestPath = `${outputRoot}/manifest.json`;
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((arg) => arg !== '--check')) {
  throw new Error('Usage: node scripts/optimize-portraits.mjs [--check]');
}

// Explicit source inventory stays independent of runtime consumer imports.
const names = [
  'assassin', 'destroyer', 'mercenary', 'hunter', 'cyborg', 'telepath',
  'fanatic', 'witcher', 'plasma-nuclear', 'nuclear', 'silver-hunter',
  'goliath', 'half-mutant', 'unknown-white-outfit-v1', 'unknown-crossbow-v3',
];
const settings = {
  full: {
    resize: { width: 768, height: 1152, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' },
    webp: { quality: 88, alphaQuality: 100, effort: 6 },
  },
  thumbnail: {
    resize: { width: 192, height: 288, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' },
    webp: { quality: 85, alphaQuality: 100, effort: 6 },
  },
};
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const files = [];

async function saveOrCheck(outputPath, data) {
  if (check) {
    const existing = await readFile(path.join(root, outputPath));
    if (!existing.equals(data)) {
      throw new Error(`${outputPath} is out of date. Run node scripts/optimize-portraits.mjs.`);
    }
  } else {
    await mkdir(path.dirname(path.join(root, outputPath)), { recursive: true });
    await writeFile(path.join(root, outputPath), data);
  }
}

for (const name of names) {
  const sourcePath = `src/assets/characters/${name}.png`;
  const original = await readFile(path.join(root, sourcePath));
  const sourceMetadata = await sharp(original).metadata();
  const sourcePixels = await sharp(original).ensureAlpha().raw().toBuffer();
  const outputs = {};

  for (const [variant, options] of Object.entries(settings)) {
    const outputPath = `${outputRoot}/${variant}/${name}.webp`;
    let pipeline = sharp(original);
    if (options.resize) pipeline = pipeline.resize(options.resize);
    const { data, info } = await pipeline.webp(options.webp).toBuffer({ resolveWithObject: true });
    if (info.width > options.resize.width || info.height > options.resize.height) {
      throw new Error(`${outputPath}: runtime image exceeds display budget.`);
    }
    await saveOrCheck(outputPath, data);
    outputs[variant] = {
      path: outputPath, width: info.width, height: info.height,
      bytes: data.length, sha256: sha256(data),
    };
  }

  // Detect unexpected concurrent modification of a source during generation.
  if (!(await readFile(path.join(root, sourcePath))).equals(original)) {
    throw new Error(`${sourcePath} changed during generation.`);
  }
  files.push({
    source: {
      path: sourcePath, width: sourceMetadata.width, height: sourceMetadata.height,
      bytes: original.length, sha256: sha256(original), rgbaSha256: sha256(sourcePixels),
    },
    outputs,
  });
}

const manifest = Buffer.from(`${JSON.stringify({
  schemaVersion: 1,
  generator: 'scripts/optimize-portraits.mjs',
  sharpVersion: sharp.versions.sharp,
  libvipsVersion: sharp.versions.vips,
  settings,
  verification: { fullDecodedRgbaEqualsSource: false, originalsPreserved: true },
  files,
}, null, 2)}\n`);
await saveOrCheck(manifestPath, manifest);

const sourceBytes = files.reduce((total, file) => total + file.source.bytes, 0);
const fullBytes = files.reduce((total, file) => total + file.outputs.full.bytes, 0);
const thumbnailBytes = files.reduce((total, file) => total + file.outputs.thumbnail.bytes, 0);
const mib = (bytes) => (bytes / 1024 / 1024).toFixed(2);
console.log(`${check ? 'Verified' : 'Generated'} ${files.length} full portraits and thumbnails; originals preserved.`);
console.log(`Display-sized WebP derivatives; original artwork remains unchanged.`);
console.log(`Originals ${mib(sourceBytes)} MiB; full ${mib(fullBytes)} MiB; thumbnails ${mib(thumbnailBytes)} MiB.`);
console.log(`Combined ${mib(fullBytes + thumbnailBytes)} MiB (${(100 * (1 - (fullBytes + thumbnailBytes) / sourceBytes)).toFixed(1)}% smaller).`);
