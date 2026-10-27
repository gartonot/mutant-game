import { EnemyType } from '@entities/enemy/EnemyType';
import { createLazyImageAsset } from './ImageAsset';

// Separate URLs let Vite bundle the sprites, without creating browser Images during simulation imports.
// Bounds measured from the original 1254 × 1254 PNGs (alpha > 8).
// Lossless runtime copies retain the full canvas and source coordinates. The transparent margin
// preserves soft edge pixels while the occupied width maps to the collider diameter.
const sprites = {
    [EnemyType.GRUNT]: { url: new URL('../assets/combat-runtime/enemies/grunt.png', import.meta.url).href,
        bounds: [332, 314, 710, 667] },
    [EnemyType.TANK]: { url: new URL('../assets/combat-runtime/enemies/tank.png', import.meta.url).href,
        bounds: [289, 266, 795, 754] },
    [EnemyType.BOSS]: { url: new URL('../assets/combat-runtime/enemies/boss.png', import.meta.url).href,
        bounds: [272, 268, 808, 758] },
} satisfies Record<EnemyType, { url: string; bounds: readonly [number, number, number, number] }>;
const images = new Map<EnemyType, ReturnType<typeof createLazyImageAsset>>();
export type EnemyTint = 'ice' | 'fire';
const tintedSprites = new Map<string, HTMLCanvasElement>();
const margin = 10;
// Preserve neighbouring texels used by filtering at the authored crop boundary.
const maskPadding = 4;
let preparation: Promise<boolean[]> | undefined;

// Cache masks per sprite/status: no canvas allocation or compositing per enemy/frame.
function prepareTint(type: EnemyType, image: HTMLImageElement, tint: EnemyTint): void {
    const key = `${type}:${tint}`;
    const cached = tintedSprites.get(key);
    if (cached) return;
    const [x, y, width, height] = sprites[type].bounds;
    const canvas = document.createElement('canvas');
    canvas.width = width + (margin + maskPadding) * 2;
    canvas.height = height + (margin + maskPadding) * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Enemy mask canvas unavailable');
    ctx.drawImage(image, margin + maskPadding - x, margin + maskPadding - y);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = tint === 'ice' ? 'rgba(100, 205, 255, 0.52)' : 'rgba(160, 20, 48, 0.52)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Flush deferred raster work while the preparation dialog is still visible.
    ctx.getImageData(0, 0, 1, 1);
    tintedSprites.set(key, canvas);
}

function prepareImage(type: EnemyType): Promise<boolean> {
    if (typeof Image === 'undefined') return Promise.resolve(false);
    let asset = images.get(type);
    if (!asset) {
        asset = createLazyImageAsset(sprites[type].url);
        images.set(type, asset);
    }
    return asset.ensure();
}

/** Optional browser preload/QA hook. Failed assets resolve false and retain the circle fallback. */
export function enemyArtReady(): Promise<boolean[]> {
    if (preparation) return preparation;
    const types = [EnemyType.GRUNT, EnemyType.TANK, EnemyType.BOSS];
    preparation = (async () => {
        const ready = await Promise.all(types.map(prepareImage));
        for (const [index, type] of types.entries()) {
            if (!ready[index]) continue;
            try {
                for (const tint of ['ice', 'fire'] as const) {
                    if (tintedSprites.has(`${type}:${tint}`)) continue;
                    // Let the loading UI paint/respond between allocations; also works in hidden tabs.
                    await new Promise<void>(resolve => setTimeout(resolve, 0));
                    prepareTint(type, images.get(type)!.asset!.image, tint);
                }
            } catch { ready[index] = false; }
        }
        return ready;
    })().finally(() => { preparation = undefined; });
    return preparation;
}

export function drawEnemyArt(ctx: CanvasRenderingContext2D, type: EnemyType,
    x: number, y: number, radius: number, facing: number, gait: number, tint?: EnemyTint): boolean {
    const asset = images.get(type)?.asset;
    if (!asset?.loaded) return false;
    const [sourceX, sourceY, occupiedWidth, occupiedHeight] = sprites[type].bounds;
    const sourceWidth = occupiedWidth + margin * 2, sourceHeight = occupiedHeight + margin * 2;
    const scale = radius * 2 / occupiedWidth;
    const width = sourceWidth * scale, height = sourceHeight * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#0005';
    ctx.beginPath();
    ctx.ellipse(1, 3, radius * .92, radius * .75, facing, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(facing + Math.sin(gait) * .025);
    const stretch = 1 + Math.sin(gait * 2) * .015;
    ctx.scale(stretch, 1 / stretch);
    ctx.imageSmoothingEnabled = true;
    const mask = tint ? tintedSprites.get(`${type}:${tint}`) : undefined;
    ctx.drawImage(mask ?? asset.image, mask ? maskPadding : sourceX - margin, mask ? maskPadding : sourceY - margin, sourceWidth, sourceHeight,
        -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
}
