import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Originals remain read-only. Bake the existing inventory-card transform once,
// instead of making 19 canvases and downloading 19 large rasters on tab opening.
const root = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = 'src/assets/equipment-runtime';
const check = process.argv.includes('--check');
if (process.argv.slice(2).some(arg => arg !== '--check')) throw Error('Usage: node scripts/optimize-equipment-art.mjs [--check]');
const hash = data => createHash('sha256').update(data).digest('hex');
const webp = { quality: 90, alphaQuality: 100, effort: 6 };
const previewSettings = { quality: 55, alphaQuality: 100, effort: 6 };
const layoutSource = await readFile(path.join(root, 'src/assets/weapons/v2/layout.ts'));
const layoutMatch = layoutSource.toString('utf8').match(/export default\s+({[\s\S]*})\s*;?\s*$/);
if (!layoutMatch) throw Error('Weapon layout format changed; review exporter');
const weaponLayout = JSON.parse(layoutMatch[1]);
const weaponManifest = JSON.parse(await readFile(path.join(root, 'src/assets/weapons-runtime/manifest.json'), 'utf8'));
const iconManifest = JSON.parse(await readFile(path.join(root, 'src/assets/icons-runtime/manifest.json'), 'utf8'));
const weaponNames = weaponManifest.files.map(file => file.id);
if (weaponNames.length !== 19 || Object.keys(weaponLayout).some(id => !weaponNames.includes(id))) throw Error('Review weapon inventory');
const bonusNames = { health: 'health', rapidFire: 'rapid-fire', moveSpeed: 'move-speed', doubleDamage: 'double-damage', shield: 'shield', iceBlast: 'ice-blast', fireBlast: 'fire-blast' };
const sources = [], weaponLayers = [], bonusLayers = [];
const weaponPreviews = {}, bonusPreviews = {};
const weaponCells = {}, bonusCells = {};

async function save(relative, data) {
    const absolute = path.join(root, relative);
    if (check) {
        if (!(await readFile(absolute)).equals(data)) throw Error(`${relative} is out of date; run node scripts/optimize-equipment-art.mjs`);
    } else { await mkdir(path.dirname(absolute), { recursive: true }); await writeFile(absolute, data); }
}
async function sourceFor(entry) {
    const data = await readFile(path.join(root, entry.path));
    if (hash(data) !== entry.sha256) throw Error(`${entry.path}: original changed; review inventory`);
    sources.push({ path: entry.path, bytes: data.length, sha256: hash(data) });
    return data;
}
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
async function sheet(width, height, layers) {
    return sharp({ create: { width, height, channels: 4, background: transparent } }).composite(layers).webp(webp).toBuffer();
}
const angle = -Math.PI * .59;
for (const [index, id] of weaponNames.entries()) {
    const entry = weaponManifest.files.find(file => file.id === id);
    const source = await sourceFor(entry.source);
    const r = weaponLayout[id];
    const rotatedWidth = Math.abs(Math.cos(angle)) * r.width + Math.abs(Math.sin(angle)) * r.height;
    const rotatedHeight = Math.abs(Math.sin(angle)) * r.width + Math.abs(Math.cos(angle)) * r.height;
    const scale = Math.min(208 / rotatedWidth, 340 / rotatedHeight);
    const resizedWidth = Math.max(1, Math.round(r.width * scale));
    const resizedHeight = Math.max(1, Math.round(r.height * scale));
    // Both Canvas and Sharp use positive clockwise image angles. Keep the
    // original negative inventory angle, centred on the 240x380 card.
    const cropped = await sharp(source).extract({ left: r.x, top: r.y, width: r.width, height: r.height })
        .resize(resizedWidth, resizedHeight, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
    const rotated = await sharp(cropped).rotate(angle * 180 / Math.PI, { background: transparent }).png().toBuffer({ resolveWithObject: true });
    const tile = await sharp({ create: { width: 240, height: 380, channels: 4, background: transparent } })
        .composite([{ input: rotated.data, left: Math.round((240 - rotated.info.width) / 2), top: Math.round((380 - rotated.info.height) / 2) }]).png().toBuffer();
    const column = index % 5, row = Math.floor(index / 5);
    weaponCells[id] = { column, row, x: column * 240, y: row * 380, width: 240, height: 380 };
    weaponLayers.push({ input: tile, left: column * 240, top: row * 380 });
    const preview = await sharp(tile).resize(80, 128, { fit: 'fill', kernel: 'lanczos3' }).webp(previewSettings).toBuffer();
    weaponPreviews[id] = `data:image/webp;base64,${preview.toString('base64')}`;
}
for (const [row, tier] of ['silver', 'gold'].entries()) for (const [column, [kind, filename]] of Object.entries(bonusNames).entries()) {
    const entry = iconManifest.files.find(file => file.output.path === `src/assets/icons-runtime/bonuses/${tier}/${filename}.png`);
    if (!entry) throw Error(`Missing original for ${tier}/${kind}`);
    const source = await sourceFor(entry.source);
    const tile = await sharp(source).resize(192, 192, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' }).png().toBuffer();
    const key = `${tier}:${kind}`;
    bonusCells[key] = { column, row, x: column * 192, y: row * 192, width: 192, height: 192 };
    bonusLayers.push({ input: tile, left: column * 192, top: row * 192 });
    const preview = await sharp(tile).resize(64, 64).webp(previewSettings).toBuffer();
    bonusPreviews[key] = `data:image/webp;base64,${preview.toString('base64')}`;
}
const weapons = await sheet(1200, 1520, weaponLayers);
const bonuses = await sheet(1344, 384, bonusLayers);
const layout = {
    weapons: { columns: 5, rows: 4, tileWidth: 240, tileHeight: 380, cells: weaponCells },
    bonuses: { columns: 7, rows: 2, tileWidth: 192, tileHeight: 192, cells: bonusCells },
};
await save(`${outputRoot}/weapons.webp`, weapons);
await save(`${outputRoot}/bonuses.webp`, bonuses);
await save(`${outputRoot}/layout.ts`, Buffer.from(`// Generated by scripts/optimize-equipment-art.mjs.\nexport const EQUIPMENT_LAYOUT = ${JSON.stringify(layout, null, 2)} as const;\n`));
const previewBytes = [...Object.values(weaponPreviews), ...Object.values(bonusPreviews)]
    .reduce((sum, url) => sum + Buffer.from(url.split(',')[1], 'base64').length, 0);
if (previewBytes > 80_000) throw Error(`Embedded equipment preview budget exceeded: ${previewBytes}`);
await save(`${outputRoot}/previews.ts`, Buffer.from(`// Generated by scripts/optimize-equipment-art.mjs.\nexport const EQUIPMENT_WEAPON_PREVIEWS = ${JSON.stringify(weaponPreviews, null, 2)} as const;\nexport const EQUIPMENT_BONUS_PREVIEWS = ${JSON.stringify(bonusPreviews, null, 2)} as const;\n`));
for (const source of sources) if (hash(await readFile(path.join(root, source.path))) !== source.sha256) throw Error(`${source.path}: concurrent original change`);
await save(`${outputRoot}/manifest.json`, Buffer.from(`${JSON.stringify({
    generator: 'scripts/optimize-equipment-art.mjs', sharpVersion: sharp.versions.sharp, libvipsVersion: sharp.versions.vips,
    layoutSource: { path: 'src/assets/weapons/v2/layout.ts', sha256: hash(layoutSource) },
    settings: { webp, previewSettings, weaponCard: { width: 240, height: 380, angle, fitWidth: 208, fitHeight: 340 }, bonusSize: 192 },
    outputs: { weapons: { bytes: weapons.length, sha256: hash(weapons) }, bonuses: { bytes: bonuses.length, sha256: hash(bonuses) }, embeddedPreviewBytes: previewBytes },
    originalsPreserved: true, sources,
}, null, 2)}\n`));
console.log(`${check ? 'Verified' : 'Generated'} equipment artwork: weapons ${weapons.length}B, bonuses ${bonuses.length}B, embedded previews ${previewBytes}B; originals preserved.`);
