import type { CharacterId, WeaponId } from '@/gameplay/ids';
import { CHARACTER_RIGS, drawRigBody } from './CharacterRig';
import type { RigRect } from './CharacterRig';
import { drawHandOverlay } from './HandOverlay';
import { drawWeapon } from './WeaponArt';
import { weaponMount } from './WeaponGeometry';
import type { ImageAsset } from './ImageAsset';

export type RasterCharacterStyle = {
    /** Shadow centre and radii in character space. */
    shadow: RigRect;
    /** Optional separate head, drawn above the weapon and fingers. */
    head?: { source: RigRect; target: RigRect; translate: readonly [number, number];
        scale: number; offset: readonly [number, number] };
};

export const DEFAULT_CHARACTER_STYLE: RasterCharacterStyle = { shadow: [-3, 3, 24, 23] };

/** One layer pipeline for every raster character; rigs remain the sole attachment calibration. */
export function drawRasterCharacter(ctx: CanvasRenderingContext2D, character: CharacterId,
    asset: ImageAsset, weapon: WeaponId, recoil: number, style = DEFAULT_CHARACTER_STYLE,
    imageOverride?: CanvasImageSource): boolean {
    if (!asset.loaded) return false;
    const body = CHARACTER_RIGS[character], image = imageOverride ?? asset.image;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#0005';
    ctx.beginPath(); ctx.ellipse(...style.shadow, 0, 0, Math.PI * 2); ctx.fill();
    drawRigBody(ctx, image, body, recoil);
    const mount = weaponMount(character, weapon);
    ctx.save(); ctx.translate(mount.x - recoil, mount.y); ctx.rotate(mount.angle); drawWeapon(ctx, weapon); ctx.restore();
    drawHandOverlay(ctx, image, body.source, body.target, body.fingers, body.rotation, recoil);
    if (body.headOcclusion) {
        // The crown is above the stock. Reuse the exact body transform so it cannot slide on recoil.
        drawHandOverlay(ctx, image, body.source, body.target, [body.headOcclusion], body.rotation, recoil);
    }
    if (style.head) {
        const head = style.head;
        ctx.save();
        ctx.translate(...head.translate);
        ctx.scale(head.scale, head.scale);
        ctx.translate(...head.offset);
        ctx.drawImage(image, ...head.source, ...head.target);
        ctx.restore();
    }
    ctx.restore();
    return true;
}
