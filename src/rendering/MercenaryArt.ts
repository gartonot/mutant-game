import type { WeaponId } from '@/gameplay/ids';
import atlasUrl from '@/assets/characters/mercenary-combat-v2.png';
import { loadImageAsset } from './ImageAsset';
import { drawRasterCharacter } from './RasterCharacterArt';
import type { RasterCharacterStyle } from './RasterCharacterArt';

const atlas = loadImageAsset(atlasUrl);
export const mercenaryArtReady = atlas.ready;

// Preserve the authored head crop and neck anchor independently of the shared body rig.
const style: RasterCharacterStyle = {
    shadow: [-3, 3, 24, 23],
    head: { source: [1240, 0, 534, 887], target: [-19, -32, 37, 61.46],
        translate: [-1, -3], scale: .75, offset: [1, 3] },
};

export function drawMercenary(ctx: CanvasRenderingContext2D, weapon: WeaponId, recoil: number): boolean {
    return drawRasterCharacter(ctx, 'mercenary', atlas, weapon, recoil, style);
}
