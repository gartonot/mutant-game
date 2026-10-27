import { loadImageAsset } from './ImageAsset';
import type { ImageAsset } from './ImageAsset';
import type { PickupTier } from '@/gameplay/PickupVariants';

export type BonusArtKind = 'shield' | 'rapidFire' | 'moveSpeed' | 'doubleDamage' | 'health' | 'iceBlast' | 'fireBlast';

const urls: Record<BonusArtKind, string> = {
    iceBlast: new URL('../assets/icons-runtime/bonuses/silver/ice-blast.png', import.meta.url).href,
    fireBlast: new URL('../assets/icons-runtime/bonuses/silver/fire-blast.png', import.meta.url).href,
    health: new URL('../assets/icons-runtime/bonuses/silver/health.png', import.meta.url).href,
    shield: new URL('../assets/icons-runtime/bonuses/silver/shield.png', import.meta.url).href,
    rapidFire: new URL('../assets/icons-runtime/bonuses/silver/rapid-fire.png', import.meta.url).href,
    moveSpeed: new URL('../assets/icons-runtime/bonuses/silver/move-speed.png', import.meta.url).href,
    doubleDamage: new URL('../assets/icons-runtime/bonuses/silver/double-damage.png', import.meta.url).href,
};
const images = new Map<BonusArtKind, ImageAsset>();
const goldUrls: Record<BonusArtKind, string> = {
    iceBlast: new URL('../assets/icons-runtime/bonuses/gold/ice-blast.png', import.meta.url).href,
    fireBlast: new URL('../assets/icons-runtime/bonuses/gold/fire-blast.png', import.meta.url).href,
    health: new URL('../assets/icons-runtime/bonuses/gold/health.png', import.meta.url).href,
    shield: new URL('../assets/icons-runtime/bonuses/gold/shield.png', import.meta.url).href,
    rapidFire: new URL('../assets/icons-runtime/bonuses/gold/rapid-fire.png', import.meta.url).href,
    moveSpeed: new URL('../assets/icons-runtime/bonuses/gold/move-speed.png', import.meta.url).href,
    doubleDamage: new URL('../assets/icons-runtime/bonuses/gold/double-damage.png', import.meta.url).href,
};
const goldImages = new Map<BonusArtKind, ImageAsset>();

/** Shared artwork for DOM equipment cards and canvas pickup medallions. */
export function bonusArtUrl(kind: BonusArtKind, tier: PickupTier = 'silver'): string {
    return (tier === 'gold' ? goldUrls : urls)[kind];
}

function imageFor(kind: BonusArtKind, tier: PickupTier = 'silver'): ImageAsset | undefined {
    if (typeof Image === 'undefined') return undefined;
    const cache = tier === 'gold' ? goldImages : images;
    let asset = cache.get(kind);
    if (!asset) {
        asset = loadImageAsset((tier === 'gold' ? goldUrls : urls)[kind]);
        cache.set(kind, asset);
    }
    return asset;
}

/** Preload hook for the shared pickup and HUD medallions. */
export function bonusArtReady(tier: PickupTier = 'silver'): Promise<boolean[]> {
    return Promise.all((Object.keys(urls) as BonusArtKind[])
        .map(kind => imageFor(kind, tier)?.ready ?? Promise.resolve(false)));
}

/** Draw the same complete medallion on the ground and in the active bonus panel. */
export function drawBonusArt(ctx: CanvasRenderingContext2D, kind: string,
    x: number, y: number, size: number, tier: PickupTier = 'silver'): boolean {
    if (!Object.prototype.hasOwnProperty.call(urls, kind)) return false;
    const asset = imageFor(kind as BonusArtKind, tier);
    if (!asset?.loaded) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(asset.image, x - size / 2, y - size / 2, size, size);
    ctx.restore();
    return true;
}
