import { loadImageAsset, type ImageAsset } from './ImageAsset';
import type { AmmoCategory } from '@/gameplay/WeaponLoot';

type AmmoArtKind = AmmoCategory | 'infinite';
const urls: Record<AmmoArtKind, string> = {
    infinite: new URL('../assets/icons-runtime/ammo/infinite.png', import.meta.url).href,
    shotgun: new URL('../assets/icons-runtime/ammo/shotgun.png', import.meta.url).href,
    automatic: new URL('../assets/icons-runtime/ammo/automatic.png', import.meta.url).href,
    special: new URL('../assets/icons-runtime/ammo/special.png', import.meta.url).href,
    scientific: new URL('../assets/icons-runtime/ammo/scientific.png', import.meta.url).href,
};
const images = new Map<AmmoArtKind, ImageAsset>();

/** Shared runtime icons for the ammunition panel and category-specific ground drops. */
export function ammoImage(kind: AmmoArtKind): ImageAsset | undefined {
    if (typeof Image === 'undefined') return undefined;
    let asset = images.get(kind);
    if (!asset) {
        asset = loadImageAsset(urls[kind]);
        images.set(kind, asset);
    }
    return asset;
}

export function drawAmmoArt(ctx: CanvasRenderingContext2D, category: AmmoCategory,
    x: number, y: number, size: number): boolean {
    const asset = ammoImage(category);
    if (!asset?.loaded) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(asset.image, x - size / 2, y - size / 2, size, size);
    ctx.restore();
    return true;
}
