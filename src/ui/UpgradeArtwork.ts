import { createLazyImageAsset } from '@/rendering/ImageAsset';
import { UPGRADE_LAYOUT } from '@/assets/upgrades-runtime/layout';
import { UPGRADE_PREVIEW } from '@/assets/upgrades-runtime/preview';

export type UpgradeArtId = keyof typeof UPGRADE_LAYOUT.cells;
const url = new URL('../assets/upgrades-runtime/upgrades.webp', import.meta.url).href;
const sheet = createLazyImageAsset(url, () => {
    const image = new Image();
    image.fetchPriority = 'high'; image.decoding = 'async';
    return image;
});

export function prepareUpgradeArtwork(): Promise<boolean> { return sheet.ensure(); }

/** Card and tooltip share one atlas. The embedded layer is always available without a request. */
export function upgradeArtwork(id: UpgradeArtId): string {
    const cell = UPGRADE_LAYOUT.cells[id];
    const x = cell.column * 100 / (UPGRADE_LAYOUT.columns - 1);
    const y = cell.row * 100 / (UPGRADE_LAYOUT.rows - 1);
    return `<span class="upgrade-art" aria-hidden="true" style="background-image:url('${url}'),url('${UPGRADE_PREVIEW}');background-size:${UPGRADE_LAYOUT.columns * 100}% ${UPGRADE_LAYOUT.rows * 100}%;background-position:${x}% ${y}%"></span>`;
}
