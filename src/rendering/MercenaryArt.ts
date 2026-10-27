import type { WeaponId } from '@/gameplay/ids';
import atlasUrl from '@/assets/combat-runtime/characters/mercenary.png';
import { createLazyImageAsset } from './ImageAsset';
import { drawRasterCharacter } from './RasterCharacterArt';
import type { RasterCharacterStyle } from './RasterCharacterArt';

const atlas = createLazyImageAsset(atlasUrl);
export function mercenaryArtReady(): Promise<boolean> { return atlas.ensure(); }

// Preserve the authored head crop and neck anchor independently of the shared body rig.
const style: RasterCharacterStyle = {
    shadow: [-3, 3, 24, 23],
    head: { source: [1240, 0, 534, 887], target: [-19, -32, 37, 61.46],
        translate: [-1, -3], scale: .75, offset: [1, 3] },
};

export function drawMercenary(ctx: CanvasRenderingContext2D, weapon: WeaponId, recoil: number): boolean {
    return atlas.asset ? drawRasterCharacter(ctx, 'mercenary', atlas.asset, weapon, recoil, style) : false;
}
