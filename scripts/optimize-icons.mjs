import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Original artwork is read-only input. Do not crop: transparent margins are
// part of the existing layout and must keep the same proportions at runtime.
const root = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = 'src/assets/icons-runtime';
const manifestPath = `${outputRoot}/manifest.json`;
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((arg) => arg !== '--check')) {
  throw new Error('Usage: node scripts/optimize-icons.mjs [--check]');
}

const groups = [
  {
    source: 'src/assets/ammo/v1', output: 'ammo',
    names: ['automatic', 'infinite', 'scientific', 'shotgun', 'special'],
  },
  ...['silver', 'gold'].map((tier) => ({
    source: `src/assets/bonuses/${tier === 'silver' ? 'v1' : 'gold-v1'}`,
    output: `bonuses/${tier}`,
    names: ['double-damage', 'fire-blast', 'health', 'ice-blast', 'move-speed', 'rapid-fire', 'shield'],
  })),
  {
    source: 'src/assets/upgrades', output: 'upgrades',
    names: ['armor-v2', 'arsenal-automatic-v2', 'arsenal-energy-v2', 'arsenal-heavy-v2',
      'arsenal-pistol-v2', 'arsenal-shotgun-v2', 'attack-speed-v2', 'damage-v2', 'health-v2', 'move-speed-v2'],
  },
];

const settings = {
  resize: { width: 256, height: 256, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' },
  png: { compressionLevel: 9, adaptiveFiltering: true, palette: false },
};
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const files = [];

for (const group of groups) {
  for (const name of group.names) {
    const sourcePath = `${group.source}/${name}.png`;
    const outputPath = `${outputRoot}/${group.output}/${name}.png`;
    const original = await readFile(path.join(root, sourcePath));
    const sourceMetadata = await sharp(original).metadata();
    const { data, info } = await sharp(original)
      .resize(settings.resize)
      .png(settings.png)
      .toBuffer({ resolveWithObject: true });

    if (check) {
      const existing = await readFile(path.join(root, outputPath));
      if (!existing.equals(data)) {
        throw new Error(`${outputPath} is out of date. Run npm run assets:icons.`);
      }
    } else {
      await mkdir(path.dirname(path.join(root, outputPath)), { recursive: true });
      await writeFile(path.join(root, outputPath), data);
    }

    files.push({
      source: {
        path: sourcePath, width: sourceMetadata.width, height: sourceMetadata.height,
        bytes: original.length, sha256: sha256(original),
      },
      output: {
        path: outputPath, width: info.width, height: info.height,
        bytes: data.length, sha256: sha256(data),
      },
    });
  }
}

const manifest = `${JSON.stringify({
  schemaVersion: 1,
  generator: 'scripts/optimize-icons.mjs',
  sharpVersion: sharp.versions.sharp,
  libvipsVersion: sharp.versions.vips,
  settings,
  files,
}, null, 2)}\n`;

if (check) {
  if (await readFile(path.join(root, manifestPath), 'utf8') !== manifest) {
    throw new Error(`${manifestPath} is out of date. Run npm run assets:icons.`);
  }
} else {
  await writeFile(path.join(root, manifestPath), manifest);
}

const sourceBytes = files.reduce((total, file) => total + file.source.bytes, 0);
const outputBytes = files.reduce((total, file) => total + file.output.bytes, 0);
console.log(`${check ? 'Verified' : 'Generated'} ${files.length} runtime icons; originals preserved.`);
console.log(`${(sourceBytes / 1024 / 1024).toFixed(2)} MiB → ${(outputBytes / 1024 / 1024).toFixed(2)} MiB (${(100 * (1 - outputBytes / sourceBytes)).toFixed(1)}% smaller).`);
