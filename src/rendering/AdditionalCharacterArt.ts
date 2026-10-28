import type { CharacterId, WeaponId } from '@/gameplay/ids';
import layout from '@/assets/characters/combat-v4/layout';
import { createLazyImageAsset } from './ImageAsset';
import { drawRasterCharacter } from './RasterCharacterArt';
import { drawGoliathSlamRaster } from './GoliathSlamArt';

// Only active runtime artwork is bundled; previous authoring versions stay on disk.
const urls = import.meta.glob<string>('../assets/combat-runtime/characters/*.png', { eager: true, query: '?url', import: 'default' });
const images = new Map<CharacterId, ReturnType<typeof createLazyImageAsset>>();
let stormTint: { source: HTMLImageElement; canvas: HTMLCanvasElement } | undefined;

/** Preserve the original fanatic texture and rig beneath a translucent electric-blue mask. */
export function drawAdditionalStormCharacter(ctx: CanvasRenderingContext2D, weapon: WeaponId, recoil: number): boolean {
    const asset = images.get('fanatic')?.asset;
    if (!asset?.loaded || typeof document === 'undefined') return false;
    if (stormTint?.source !== asset.image) {
        const canvas = document.createElement('canvas');
        canvas.width = asset.image.naturalWidth;
        canvas.height = asset.image.naturalHeight;
        const tint = canvas.getContext('2d');
        if (!tint) return false;
        tint.drawImage(asset.image, 0, 0);
        tint.globalCompositeOperation = 'source-atop';
        tint.fillStyle = 'rgba(74, 184, 255, 0.38)';
        tint.fillRect(0, 0, canvas.width, canvas.height);
        stormTint = { source: asset.image, canvas };
    }
    // Only the hero's pixels are tinted; shadow and equipped weapon retain their normal art.
    return drawRasterCharacter(ctx, 'fanatic', asset, weapon, recoil, undefined, stormTint.canvas);
}
export function ensureAdditionalCharacterArt(id: CharacterId): Promise<boolean> {
    if (id === 'mercenary' || id === 'assassin' || id === 'destroyer') return Promise.resolve(false);
    if (!Object.prototype.hasOwnProperty.call(layout, id)) return Promise.resolve(false);
    const url = urls[`../assets/combat-runtime/characters/${id}.png`];
    if (!url || typeof Image === 'undefined') return Promise.resolve(false);
    let source = images.get(id);
    if (!source) { source = createLazyImageAsset(url); images.set(id, source); }
    return source.ensure();
}

export function drawAdditionalCharacter(ctx: CanvasRenderingContext2D, character: CharacterId, weapon: WeaponId, recoil: number): boolean {
    if (character === 'mercenary' || character === 'assassin' || character === 'destroyer') return false;
    const asset = images.get(character)?.asset;
    return asset ? drawRasterCharacter(ctx, character, asset, weapon, recoil) : false;
}

export function loadedAdditionalCharacters(): CharacterId[] {
    return [...images].filter(([, source]) => source.asset?.loaded).map(([id]) => id);
}

export function drawAdditionalGoliathSlam(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, progress: number): void {
    drawGoliathSlamRaster(ctx, images.get('goliath')?.asset, x, y, angle, progress);
}
