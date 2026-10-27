import type { WeaponId } from '@/gameplay/ids';
import { WEAPON_ART, WEAPON_ORDER } from './WeaponGeometry';
import layouts from '@/assets/weapons/v2/layout';
import { createLazyImageAsset } from './ImageAsset';

type Layout = { x: number; y: number; width: number; height: number; axisY: number };
const regions: Partial<Record<WeaponId, Layout>> = layouts;
// Simulation-only consumers can import pickups without a browser image runtime.
const urls = typeof Image === 'undefined' ? {} : import.meta.glob<string>('../assets/weapons-runtime/*.webp', { eager: true, query: '?url', import: 'default' });
const sprites = new Map<WeaponId, ReturnType<typeof createLazyImageAsset>>();
const inventoryIcons = new Map<WeaponId, string>();

/** Failure leaves the Canvas fallback usable, including offline/missing-asset cases. */
export function weaponSpritesReady(): Promise<boolean[]> { return Promise.all(WEAPON_ORDER.map(id => {
    const url = urls[`../assets/weapons-runtime/${id}.webp`];
    if (!url) return Promise.resolve(false);
    let source = sprites.get(id);
    if (!source) { source = createLazyImageAsset(url); sprites.set(id, source); }
    return source.ensure();
})); }

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

/** Same illustration in a portrait card, generated once after its source has loaded. */
export function weaponSpriteInventoryIcon(id: WeaponId): string | undefined {
    const cached = inventoryIcons.get(id);
    if (cached) return cached;
    const asset = sprites.get(id)?.asset, r = regions[id];
    if (!asset?.loaded || !r) return undefined;
    const canvas = document.createElement('canvas');
    canvas.width = 240; canvas.height = 380;
    const ctx = canvas.getContext('2d')!;
    const angle = -Math.PI * .59;
    const rotatedWidth = Math.abs(Math.cos(angle)) * r.width + Math.abs(Math.sin(angle)) * r.height;
    const rotatedHeight = Math.abs(Math.sin(angle)) * r.width + Math.abs(Math.cos(angle)) * r.height;
    const scale = Math.min(208 / rotatedWidth, 340 / rotatedHeight);
    ctx.translate(120, 190); ctx.rotate(angle);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(asset.image, -r.width * scale / 2, -r.height * scale / 2, r.width * scale, r.height * scale);
    const url = canvas.toDataURL();
    inventoryIcons.set(id, url);
    return url;
}

export function loadedWeaponSprites(): WeaponId[] {
    return [...sprites].filter(([, source]) => source.asset?.loaded).map(([id]) => id);
}

export function isWeaponSpriteLoaded(id: WeaponId): boolean {
    return sprites.get(id)?.asset?.loaded ?? false;
}
