import { EnemyType } from '@entities/enemy/EnemyType';
import { loadImageAsset } from './ImageAsset';
import type { ImageAsset } from './ImageAsset';

// Separate URLs let Vite bundle the sprites, without creating browser Images during simulation imports.
// Bounds measured from the 1254 × 1254 PNGs (alpha > 8). The transparent margin
// preserves soft edge pixels while the occupied width maps to the collider diameter.
const sprites = {
    [EnemyType.GRUNT]: { url: new URL('../assets/enemies/v1/grunt.png', import.meta.url).href,
        bounds: [332, 314, 710, 667] },
    [EnemyType.TANK]: { url: new URL('../assets/enemies/v1/tank.png', import.meta.url).href,
        bounds: [289, 266, 795, 754] },
    [EnemyType.BOSS]: { url: new URL('../assets/enemies/v1/boss.png', import.meta.url).href,
        bounds: [272, 268, 808, 758] },
} satisfies Record<EnemyType, { url: string; bounds: readonly [number, number, number, number] }>;
const images = new Map<EnemyType, ImageAsset>();

function imageFor(type: EnemyType): ImageAsset | undefined {
    if (typeof Image === 'undefined') return undefined;
    let asset = images.get(type);
    if (!asset) {
        asset = loadImageAsset(sprites[type].url);
        images.set(type, asset);
    }
    return asset;
}

/** Optional browser preload/QA hook. Failed assets resolve false and retain the circle fallback. */
export function enemyArtReady(): Promise<boolean[]> {
    return Promise.all([EnemyType.GRUNT, EnemyType.TANK, EnemyType.BOSS]
        .map(type => imageFor(type)?.ready ?? Promise.resolve(false)));
}

export function drawEnemyArt(ctx: CanvasRenderingContext2D, type: EnemyType,
    x: number, y: number, radius: number, facing: number, gait: number): boolean {
    const asset = imageFor(type);
    if (!asset?.loaded) return false;
    const [sourceX, sourceY, occupiedWidth, occupiedHeight] = sprites[type].bounds;
    const margin = 10;
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
    ctx.drawImage(asset.image, sourceX - margin, sourceY - margin, sourceWidth, sourceHeight,
        -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
}
