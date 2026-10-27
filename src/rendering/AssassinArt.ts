import type { WeaponId } from '@/gameplay/ids';
import atlasUrl from '@/assets/characters/assassin-combat-v2.png';
import { loadImageAsset } from './ImageAsset';
import { drawRasterCharacter } from './RasterCharacterArt';
import type { RasterCharacterStyle } from './RasterCharacterArt';

const atlas = loadImageAsset(atlasUrl);
export const assassinArtReady = atlas.ready;

// Preserve the authored head crop and neck anchor independently of the shared body rig.
const style: RasterCharacterStyle = {
    shadow: [-3, 3, 21, 21],
    head: { source: [1260, 0, 514, 887], target: [-16, -29, 31, 53.5],
        translate: [-1, -3], scale: .75, offset: [1, 3] },
};

export function drawAssassin(ctx: CanvasRenderingContext2D, weapon: WeaponId, recoil: number): boolean {
    return drawRasterCharacter(ctx, 'assassin', atlas, weapon, recoil, style);
}
