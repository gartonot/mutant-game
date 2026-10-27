import type { WeaponId } from '@/gameplay/ids';
import atlasUrl from '@/assets/combat-runtime/characters/destroyer.png';
import { createLazyImageAsset } from './ImageAsset';
import { drawRasterCharacter } from './RasterCharacterArt';
import type { RasterCharacterStyle } from './RasterCharacterArt';

const atlas = createLazyImageAsset(atlasUrl);
export function destroyerArtReady(): Promise<boolean> { return atlas.ensure(); }

// Preserve the authored head crop and neck anchor independently of the shared body rig.
const style: RasterCharacterStyle = {
    shadow: [-3, 5, 28, 29],
    head: { source: [1290, 0, 484, 887], target: [-21.5, -36.5, 40, 73.31],
        translate: [-1, 5], scale: .75, offset: [0, 0] },
};

export function drawDestroyer(ctx: CanvasRenderingContext2D, weapon: WeaponId, recoil: number): boolean {
    return atlas.asset ? drawRasterCharacter(ctx, 'destroyer', atlas.asset, weapon, recoil, style) : false;
}
