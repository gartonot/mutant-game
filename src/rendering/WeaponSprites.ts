import type { WeaponId } from '@/gameplay/ids';
import { WEAPON_ART, WEAPON_ORDER } from './WeaponGeometry';
import layouts from '@/assets/weapons/v2/layout';
import { createLazyImageAsset } from './ImageAsset';

type Layout = { x: number; y: number; width: number; height: number; axisY: number };
const regions: Partial<Record<WeaponId, Layout>> = layouts;
// Simulation-only consumers can import pickups without a browser image runtime.
const combatUrls = typeof Image === 'undefined' ? {} : import.meta.glob<string>('../assets/weapons-combat/*.webp', { eager: true, query: '?url', import: 'default' });
const sprites = new Map<WeaponId, ReturnType<typeof createLazyImageAsset>>();

/** Failure leaves the Canvas fallback usable, including offline/missing-asset cases. */
function prepareSprites(urls: Record<string, string>, directory: string,
    cache: Map<WeaponId, ReturnType<typeof createLazyImageAsset>>): Promise<boolean[]> {
    return Promise.all(WEAPON_ORDER.map(id => {
        const url = urls[`../assets/${directory}/${id}.webp`];
        if (!url) return Promise.resolve(false);
        let source = cache.get(id);
        if (!source) { source = createLazyImageAsset(url); cache.set(id, source); }
        return source.ensure();
    }));
}

export function weaponSpritesReady(): Promise<boolean[]> {
    return prepareSprites(combatUrls, 'weapons-combat', sprites);
}

// Sprite geometry depends only on authoring data, never on the current frame.
const targets = Object.fromEntries(WEAPON_ORDER.map(id => {
    const r = regions[id];
    if (!r) return [id, [0, 0, 0, 0]];
    const rear = id === 'pistol' ? -2 : id === 'plasma-grenade' ? 1 : -14;
    const width = id === 'plasma-grenade' ? 26 : WEAPON_ART[id].muzzle - rear;
    const scale = width / r.width;
    return [id, [rear, -(r.axisY - r.y) * scale, width, r.height * scale]];
})) as Record<WeaponId, [number, number, number, number]>;

/** Fits the alpha silhouette to the existing muzzle without stretching its aspect ratio. */
export function drawWeaponSprite(ctx: CanvasRenderingContext2D, id: WeaponId): boolean {
    const asset = sprites.get(id)?.asset, r = regions[id];
    if (!asset?.loaded || !r) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Export already contains exactly the authored source region. Keep target
    // geometry in authoring units so resampling cannot shift grips or muzzle.
    ctx.drawImage(asset.image, ...targets[id]);
    ctx.restore();
    return true;
}

export function isWeaponSpriteLoaded(id: WeaponId): boolean {
    return sprites.get(id)?.asset?.loaded ?? false;
}
