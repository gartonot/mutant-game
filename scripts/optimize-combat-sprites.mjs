import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Source artwork is read-only. Keep the entire original canvas: authored body,
// head, palm and enemy crop coordinates continue to address identical pixels.
const root = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = 'src/assets/combat-runtime';
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((arg) => arg !== '--check')) {
  throw new Error('Usage: node scripts/optimize-combat-sprites.mjs [--check]');
}
// Retain the PNG decoding path too: browser WebP alpha premultiplication can
// round differently even when the unpremultiplied source RGBA bytes match.
const settings = { resize: null, crop: null,
  png: { compressionLevel: 9, adaptiveFiltering: true, effort: 10, palette: false } };
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

// Explicit active inventory; do not accidentally export superseded v3 artwork.
const sources = [
  ...['mercenary', 'destroyer', 'assassin'].map((id) => ({
    id, category: 'characters', path: `src/assets/characters/${id}-combat-v2.png`,
  })),
  ...['telepath', 'cyborg', 'plasma-nuclear', 'hunter', 'unknown-crossbow', 'unknown-white-outfit'].map((id) => ({
    id, category: 'characters', path: `src/assets/characters/combat-v3/${id}.png`,
  })),
  ...['half-mutant', 'goliath', 'fanatic', 'nuclear', 'silver-hunter', 'witcher'].map((id) => ({
    id, category: 'characters', path: `src/assets/characters/combat-v4/${id}.png`,
  })),
  ...['grunt', 'tank', 'boss'].map((id) => ({
    id, category: 'enemies', path: `src/assets/enemies/v1/${id}.png`,
  })),
];

// Check the two additional-character inventories as data, without evaluating TS.
const layouts = [];
for (const version of ['combat-v3', 'combat-v4']) {
  const layoutPath = `src/assets/characters/${version}/layout.ts`;
  const bytes = await readFile(path.join(root, layoutPath));
  const keys = [...bytes.toString('utf8').matchAll(/^  "([a-z-]+)": \{/gm)].map((match) => match[1]);
  const expected = sources.filter((source) => source.path.includes(`/${version}/`)).map((source) => source.id);
  // v3 also retains the six original layouts overridden by v4.
  const expectedKeys = version === 'combat-v3'
    ? sources.filter((source) => /\/combat-v[34]\//.test(source.path)).map((source) => source.id)
    : expected;
  if (keys.length !== expectedKeys.length || expectedKeys.some((id) => !keys.includes(id))) {
    throw new Error(`${layoutPath}: active source inventory changed; review exporter inventory.`);
  }
  layouts.push({ path: layoutPath, sha256: sha256(bytes) });
}

async function saveOrCheck(outputPath, bytes) {
  const absolutePath = path.join(root, outputPath);
  if (check) {
    if (!(await readFile(absolutePath)).equals(bytes)) {
      throw new Error(`${outputPath} is out of date. Run node scripts/optimize-combat-sprites.mjs.`);
    }
  } else {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);
  }
}

const files = [];
for (const source of sources) {
  const original = await readFile(path.join(root, source.path));
  const metadata = await sharp(original).metadata();
  const sourcePixels = await sharp(original).ensureAlpha().raw().toBuffer();
  const { data, info } = await sharp(original).png(settings.png).toBuffer({ resolveWithObject: true });
  const outputPixels = await sharp(data).ensureAlpha().raw().toBuffer();
  const outputPath = `${outputRoot}/${source.category}/${source.id}.png`;
  if (info.width !== metadata.width || info.height !== metadata.height || !sourcePixels.equals(outputPixels)) {
    throw new Error(`${outputPath}: exact decoded RGBA verification failed.`);
  }
  await saveOrCheck(outputPath, data);
  if (!(await readFile(path.join(root, source.path))).equals(original)) {
    throw new Error(`${source.path} changed during generation.`);
  }
  files.push({
    id: source.id, category: source.category,
    source: { path: source.path, width: metadata.width, height: metadata.height,
      bytes: original.length, sha256: sha256(original), rgbaSha256: sha256(sourcePixels) },
    output: { path: outputPath, width: info.width, height: info.height,
      bytes: data.length, sha256: sha256(data), rgbaSha256: sha256(outputPixels) },
  });
}
for (const layout of layouts) {
  if (sha256(await readFile(path.join(root, layout.path))) !== layout.sha256) {
    throw new Error(`${layout.path} changed during generation.`);
  }
}
await saveOrCheck(`${outputRoot}/manifest.json`, Buffer.from(`${JSON.stringify({
  schemaVersion: 1, generator: 'scripts/optimize-combat-sprites.mjs',
  sharpVersion: sharp.versions.sharp, libvipsVersion: sharp.versions.vips,
  settings, layouts, verification: { fullDecodedRgbaEqualsSource: true }, files,
}, null, 2)}\n`));
const mib = (bytes) => (bytes / 1024 / 1024).toFixed(2);
console.log(`${check ? 'Verified' : 'Generated'} ${files.length} combat sprites; originals preserved.`);
console.log('Full decoded RGBA pixels match all originals exactly, including transparent pixels.');
for (const category of ['characters', 'enemies', 'all']) {
  const group = files.filter((file) => category === 'all' || file.category === category);
  const before = group.reduce((sum, file) => sum + file.source.bytes, 0);
  const after = group.reduce((sum, file) => sum + file.output.bytes, 0);
  console.log(`${category}: ${mib(before)} -> ${mib(after)} MiB (${(100 * (1 - after / before)).toFixed(1)}% smaller).`);
}
