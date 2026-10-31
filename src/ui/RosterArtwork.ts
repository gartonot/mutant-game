import { createLazyImageAsset } from '@/rendering/ImageAsset';
import { ROSTER_LAYOUT } from '@/assets/portraits-runtime/roster-layout';
import type { CharacterId } from '@/gameplay/ids';
import { ROSTER_PREVIEW } from '@/assets/selection-preview-data';

const url = new URL('../assets/portraits-runtime/roster.webp', import.meta.url).href;
const atlas = createLazyImageAsset(url, () => {
    const image = new Image();
    image.fetchPriority = 'high';
    image.decoding = 'async';
    return image;
});

export function rosterArtworkReady(): Promise<boolean> { return atlas.ensure(); }

/** One shared request for the entire roster, with the original thumbnail framing. */
export function rosterArtwork(id: CharacterId): string {
    const { column, row } = ROSTER_LAYOUT.cells[id];
    const x = column * 100 / (ROSTER_LAYOUT.columns - 1);
    const y = row * 100 / (ROSTER_LAYOUT.rows - 1);
    return `<span class="roster-art" aria-hidden="true" style="background-image:url('${url}'),url('${ROSTER_PREVIEW}');background-position:${x}% ${y}%;background-size:${ROSTER_LAYOUT.columns * 100}% ${ROSTER_LAYOUT.rows * 100}%"></span>`;
}
