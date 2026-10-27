import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Originals are read-only. Export exactly the rectangle already drawn by the
// game, without new alpha trimming. Consumers retain original target geometry.
const root = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = 'src/assets/weapons-runtime';
const layoutPath = 'src/assets/weapons/v2/layout.ts';
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((arg) => arg !== '--check')) {
  throw new Error('Usage: node scripts/optimize-weapons.mjs [--check]');
}
const names = [
  'ak47', 'double-barrel', 'flamethrower', 'grenade-launcher', 'laser',
  'm16', 'machine-gun', 'pistol', 'plasma-auto', 'plasma-cannon',
  'plasma-grenade', 'rifle', 'shotgun', 'skull-launcher', 'tesla',
  'impulse', 'acid-gun', 'crossbow', 'disc-launcher',
];
const settings = {
  crop: 'exact original layout rectangle; no additional alpha trimming',
  resize: { width: 768, height: 768, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' },
  webp: { lossless: true, effort: 6 },
};
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const layoutSource = await readFile(path.join(root, layoutPath));
// Parse data only: layout.ts intentionally consists of comments and a JSON
// default export. Fail explicitly if its format changes; never evaluate code.
const layoutMatch = layoutSource.toString('utf8').match(/^\s*(?:\/\/[^\n]*\n\s*)*export default (\{[\s\S]*\});\s*$/);
if (!layoutMatch) throw new Error(`${layoutPath}: expected a JSON default export.`);
const layout = JSON.parse(layoutMatch[1]);
if (Object.keys(layout).length !== names.length || names.some((name) => !Object.hasOwn(layout, name))) {
  throw new Error(`${layoutPath}: source inventory changed; review exports before regenerating.`);
}
const files = [];
async function saveOrCheck(outputPath, data) {
  const absolutePath = path.join(root, outputPath);
  if (check) {
    if (!(await readFile(absolutePath)).equals(data)) {
      throw new Error(`${outputPath} is out of date. Run node scripts/optimize-weapons.mjs.`);
    }
  } else {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, data);
  }
}
for (const name of names) {
  const sourcePath = `src/assets/weapons/v2/${name}.png`;
  const original = await readFile(path.join(root, sourcePath));
  const metadata = await sharp(original).metadata();
  const { x, y, width, height, axisY } = layout[name];
  if (![x, y, width, height].every(Number.isInteger)
      || x < 0 || y < 0 || width <= 0 || height <= 0
      || x + width > metadata.width || y + height > metadata.height
      || !Number.isFinite(axisY) || axisY < y || axisY > y + height) {
    throw new Error(`${name}: invalid original source rectangle or muzzle axis.`);
  }
  const { data, info } = await sharp(original)
    .extract({ left: x, top: y, width, height })
    .resize(settings.resize)
    .webp(settings.webp)
    .toBuffer({ resolveWithObject: true });
  const outputPath = `${outputRoot}/${name}.webp`;
  await saveOrCheck(outputPath, data);
  if (!(await readFile(path.join(root, sourcePath))).equals(original)) {
    throw new Error(`${sourcePath} changed during generation.`);
  }
  files.push({
    id: name,
    source: {
      path: sourcePath, width: metadata.width, height: metadata.height,
      bytes: original.length, sha256: sha256(original),
      region: { x, y, width, height, axisY },
    },
    output: {
      path: outputPath, width: info.width, height: info.height,
      bytes: data.length, sha256: sha256(data),
    },
  });
}
if (!(await readFile(path.join(root, layoutPath))).equals(layoutSource)) {
  throw new Error(`${layoutPath} changed during generation.`);
}
await saveOrCheck(`${outputRoot}/manifest.json`, Buffer.from(`${JSON.stringify({
  schemaVersion: 1,
  generator: 'scripts/optimize-weapons.mjs',
  sharpVersion: sharp.versions.sharp,
  libvipsVersion: sharp.versions.vips,
  layout: { path: layoutPath, sha256: sha256(layoutSource) },
  settings,
  files,
}, null, 2)}\n`));
const sourceBytes = files.reduce((sum, file) => sum + file.source.bytes, 0);
const outputBytes = files.reduce((sum, file) => sum + file.output.bytes, 0);
const mib = (bytes) => (bytes / 1024 / 1024).toFixed(2);
console.log(`${check ? 'Verified' : 'Generated'} ${files.length} weapon images; originals preserved.`);
console.log(`Originals ${mib(sourceBytes)} MiB; runtime ${mib(outputBytes)} MiB (${(100 * (1 - outputBytes / sourceBytes)).toFixed(1)}% smaller).`);
