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
    [EnemyType.BUG]: { url: new URL('../assets/combat-runtime/enemies/bug.png', import.meta.url).href,
        bounds: [33, 137, 1186, 956] },
    [EnemyType.RUNNER]: { url: new URL('../assets/combat-runtime/enemies/runner.png', import.meta.url).href,
        bounds: [36, 226, 1193, 797] },
    [EnemyType.ARMORED]: { url: new URL('../assets/combat-runtime/enemies/armored.png', import.meta.url).href,
        bounds: [61, 75, 1139, 1096] },
} satisfies Record<EnemyType, { url: string; bounds: readonly [number, number, number, number] }>;
type RasterEnemy = keyof typeof sprites;
const proceduralTypes = [EnemyType.BUG, EnemyType.RUNNER, EnemyType.ARMORED] as const;
const proceduralSprites = new Map<string, HTMLCanvasElement>();
const images = new Map<EnemyType, ReturnType<typeof createLazyImageAsset>>();
export type EnemyTint = 'ice' | 'fire';
const tintedSprites = new Map<string, HTMLCanvasElement>();
const margin = 10;
// Preserve neighbouring texels used by filtering at the authored crop boundary.
const maskPadding = 4;
let preparation: Promise<boolean[]> | undefined;

// Cache masks per sprite/status: no canvas allocation or compositing per enemy/frame.
function prepareTint(type: RasterEnemy, image: HTMLImageElement, tint: EnemyTint): void {
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

function prepareImage(type: RasterEnemy): Promise<boolean> {
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
    const types = Object.keys(sprites) as RasterEnemy[];
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
        if (typeof document !== 'undefined') {
            for (const type of proceduralTypes) for (const tint of [undefined, 'ice', 'fire'] as const) {
                prepareProcedural(type, tint);
            }
        }
        return ready;
    })().finally(() => { preparation = undefined; });
    return preparation;
}

export function drawEnemyArt(ctx: CanvasRenderingContext2D, type: EnemyType,
    x: number, y: number, radius: number, facing: number, gait: number, tint?: EnemyTint): boolean {
    const asset = images.get(type)?.asset;
    if (!asset?.loaded && proceduralTypes.includes(type as typeof proceduralTypes[number])) {
        const sprite = proceduralSprites.get(`${type}:${tint ?? 'normal'}`) ?? prepareProcedural(type, tint);
        if (!sprite) return false;
        ctx.save(); ctx.translate(x, y); ctx.rotate(facing + Math.sin(gait) * .04);
        ctx.drawImage(sprite, -radius * 1.2, -radius * 1.2, radius * 2.4, radius * 2.4);
        ctx.restore();
        return true;
    }
    if (!asset?.loaded) return false;
    const [sourceX, sourceY, occupiedWidth, occupiedHeight] = sprites[type as RasterEnemy].bounds;
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

/** Authored top-down silhouettes rasterized once, including status variants. */
function prepareProcedural(type: EnemyType, tint?: EnemyTint): HTMLCanvasElement | undefined {
    const key = `${type}:${tint ?? 'normal'}`;
    const cached = proceduralSprites.get(key);
    if (cached) return cached;
    if (typeof document === 'undefined') return undefined;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d'); if (!ctx) return undefined;
    ctx.translate(64, 64); ctx.strokeStyle = '#1a2021'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    const ellipse = (x: number, y: number, rx: number, ry: number, color: string) => {
        ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    };
    const polygon = (points: number[][], color: string) => {
        ctx.fillStyle = color; ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.closePath(); ctx.fill(); ctx.stroke();
    };
    if (type === EnemyType.BUG) {
        // Six angular legs, split ochre shell and forward mandibles.
        ctx.lineWidth = 6; ctx.strokeStyle = '#4c381e';
        for (const side of [-1, 1]) for (const offset of [-22, 0, 22]) {
            ctx.beginPath(); ctx.moveTo(offset, side * 15); ctx.lineTo(offset - 12, side * 38);
            ctx.lineTo(offset + 3, side * 48); ctx.stroke();
        }
        ctx.lineWidth = 3; ctx.strokeStyle = '#302817';
        ellipse(-10, 0, 30, 27, '#a28231'); ellipse(22, 0, 17, 19, '#6a531d');
        polygon([[32, -13], [48, -18], [42, -4]], '#d7bc65');
        polygon([[32, 13], [48, 18], [42, 4]], '#d7bc65');
        ctx.beginPath(); ctx.moveTo(-39, 0); ctx.lineTo(12, 0); ctx.stroke();
        ellipse(25, -10, 3, 3, '#f0df9d'); ellipse(25, 10, 3, 3, '#f0df9d');
    } else if (type === EnemyType.RUNNER) {
        // Lean red body with long reaching arms and swept-back legs.
        polygon([[-16, -15], [-46, -32], [-49, -21], [-24, -3]], '#604039');
        polygon([[-16, 15], [-46, 32], [-49, 21], [-24, 3]], '#604039');
        polygon([[0, -18], [28, -37], [47, -31], [27, -24], [14, -6]], '#ae6660');
        polygon([[0, 18], [28, 37], [47, 31], [27, 24], [14, 6]], '#ae6660');
        ellipse(-5, 0, 25, 17, '#8f4847'); ellipse(23, 0, 16, 14, '#c28775');
        ctx.lineWidth = 2; polygon([[28, -8], [36, -6], [32, -3]], '#ffe7a1');
        polygon([[28, 8], [36, 6], [32, 3]], '#ffe7a1');
    } else {
        // Broad segmented blue-grey armor, outlined plates and small exposed head.
        ellipse(-21, -28, 19, 14, '#39464d'); ellipse(-21, 28, 19, 14, '#39464d');
        ellipse(18, -31, 17, 15, '#829397'); ellipse(18, 31, 17, 15, '#829397');
        ellipse(37, 0, 14, 16, '#ae9683');
        polygon([[-39, -23], [-14, -36], [20, -25], [29, 0], [20, 25], [-14, 36], [-39, 23]], '#657b85');
        polygon([[-29, -18], [-8, -24], [12, -16], [18, 0], [12, 16], [-8, 24], [-29, 18]], '#94a5a9');
        ctx.strokeStyle = '#455963'; ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(18, 0); ctx.stroke();
        ellipse(40, -7, 2, 2, '#cf3c25'); ellipse(40, 7, 2, 2, '#cf3c25');
    }
    if (tint) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = tint === 'ice' ? 'rgba(100, 205, 255, .52)' : 'rgba(160, 20, 48, .52)';
        ctx.fillRect(-64, -64, 128, 128);
    }
    ctx.getImageData(0, 0, 1, 1);
    proceduralSprites.set(key, canvas); return canvas;
}
