import type { WeaponId } from '@/gameplay/ids';
import { WEAPON_ART, WEAPON_ORDER } from './WeaponGeometry';
import layouts from '@/assets/weapons/v2/layout';
import { loadImageAsset } from './ImageAsset';
import type { ImageAsset } from './ImageAsset';

type Layout = { x: number; y: number; width: number; height: number; axisY: number };
const regions: Record<WeaponId, Layout> = layouts;
const urls = import.meta.glob<string>('../assets/weapons/v2/*.png', { eager: true, query: '?url', import: 'default' });
const sprites = new Map<WeaponId, ImageAsset>();
const inventoryIcons = new Map<WeaponId, string>();

/** Failure leaves the Canvas fallback usable, including offline/missing-asset cases. */
export const weaponSpritesReady = Promise.all(WEAPON_ORDER.map(id => {
    const url = urls[`../assets/weapons/v2/${id}.png`];
    if (!url) return Promise.resolve(false);
    const asset = loadImageAsset(url);
    sprites.set(id, asset);
    return asset.ready;
}));

// Sprite geometry depends only on authoring data, never on the current frame.
const targets = Object.fromEntries(WEAPON_ORDER.map(id => {
    const r = regions[id];
    const rear = id === 'pistol' ? -2 : id === 'plasma-grenade' ? 1 : -14;
    const width = id === 'plasma-grenade' ? 26 : WEAPON_ART[id].muzzle - rear;
    const scale = width / r.width;
    return [id, [rear, -(r.axisY - r.y) * scale, width, r.height * scale]];
})) as Record<WeaponId, [number, number, number, number]>;

/** Fits the alpha silhouette to the existing muzzle without stretching its aspect ratio. */
export function drawWeaponSprite(ctx: CanvasRenderingContext2D, id: WeaponId): boolean {
    const asset = sprites.get(id), r = regions[id];
    if (!asset?.loaded) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(asset.image, r.x, r.y, r.width, r.height, ...targets[id]);
    ctx.restore();
    return true;
}

/** Same illustration in a portrait card, generated once after its source has loaded. */
export function weaponSpriteInventoryIcon(id: WeaponId): string | undefined {
    const cached = inventoryIcons.get(id);
    if (cached) return cached;
    const asset = sprites.get(id), r = regions[id];
    if (!asset?.loaded) return undefined;
    const canvas = document.createElement('canvas');
    canvas.width = 240; canvas.height = 380;
    const ctx = canvas.getContext('2d')!;
    const angle = -Math.PI * .59;
    const rotatedWidth = Math.abs(Math.cos(angle)) * r.width + Math.abs(Math.sin(angle)) * r.height;
    const rotatedHeight = Math.abs(Math.sin(angle)) * r.width + Math.abs(Math.cos(angle)) * r.height;
    const scale = Math.min(208 / rotatedWidth, 340 / rotatedHeight);
    ctx.translate(120, 190); ctx.rotate(angle);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(asset.image, r.x, r.y, r.width, r.height, -r.width * scale / 2, -r.height * scale / 2, r.width * scale, r.height * scale);
    const url = canvas.toDataURL();
    inventoryIcons.set(id, url);
    return url;
}

export function loadedWeaponSprites(): WeaponId[] {
    return [...sprites].filter(([, asset]) => asset.loaded).map(([id]) => id);
}
