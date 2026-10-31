import type { CharacterId } from '@/gameplay/ids';
import { createLazyImageAsset } from './ImageAsset';
import { ABILITY_LAYOUT } from '@/assets/abilities-runtime/ability-layout';
import { ABILITY_PREVIEW } from '@/assets/selection-preview-data';

const url = typeof Image === 'undefined' ? '' : new URL('../assets/abilities-runtime/abilities.webp', import.meta.url).href;
const sheet = createLazyImageAsset(url, () => {
    const image = new Image();
    image.fetchPriority = 'high';
    image.decoding = 'async';
    return image;
});
function cellFor(character: CharacterId | undefined) {
    return character ? ABILITY_LAYOUT.cells[character as keyof typeof ABILITY_LAYOUT.cells] : undefined;
}

/** The unknown costumes deliberately have no invented ability artwork. */
export function abilityIconStyle(character: CharacterId | undefined): string | undefined {
    const cell = cellFor(character);
    if (!cell) return undefined;
    return `background-image:url('${url}'),url('${ABILITY_PREVIEW}');background-size:${ABILITY_LAYOUT.columns * 100}% ${ABILITY_LAYOUT.rows * 100}%;background-position:${cell.column * 100 / (ABILITY_LAYOUT.columns - 1)}% ${cell.row * 100 / (ABILITY_LAYOUT.rows - 1)}%`;
}

/** All heroes share one decoded catalog, prepared already in the main menu. */
export function ensureAbilityIcons(_character?: CharacterId): Promise<void> {
    return abilityArtworkReady().then(() => {});
}

export function abilityArtworkReady(): Promise<boolean> {
    return typeof Image === 'undefined' ? Promise.resolve(false) : sheet.ensure();
}

export function drawAbilityIcon(ctx: CanvasRenderingContext2D, character: CharacterId | undefined,
    x: number, y: number, size: number, radius = 6): boolean {
    const cell = cellFor(character), asset = sheet.asset;
    if (!cell || !asset?.loaded) return false;
    const image = asset.image;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, size, size, radius); ctx.clip();
    ctx.drawImage(image, cell.x, cell.y, cell.width, cell.height, x, y, size, size);
    ctx.restore();
    return true;
}
