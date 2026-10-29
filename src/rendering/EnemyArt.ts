import { EnemyType } from '@entities/enemy/EnemyType';
import { createLazyImageAsset } from './ImageAsset';

type Sprite = { url: string; bounds: readonly [number, number, number, number] };
const zombieSprite: Sprite = { url: new URL('../assets/combat-runtime/enemies/grunt.png', import.meta.url).href, bounds: [332, 314, 710, 667] };
// Authored transparent rasters, cropped and resized offline to keep preparation and draw cheap.
const sprites: Record<EnemyType | 'fat-corpse' | 'tank-green' | 'fat-corpse-green', Sprite> = {
    [EnemyType.GRUNT]: zombieSprite,
    [EnemyType.TANK]: { url: new URL('../assets/enemies/v3/tank.png', import.meta.url).href, bounds: [12,12,384,356] },
    [EnemyType.BOSS]: { url: new URL('../assets/enemies/v3/boss.png', import.meta.url).href, bounds: [12,12,384,271] },
    [EnemyType.BUG]: { url: new URL('../assets/enemies/v3/bug.png', import.meta.url).href, bounds: [12,12,384,317] },
    [EnemyType.RUNNER]: zombieSprite,
    [EnemyType.ARMORED]: { url: new URL('../assets/enemies/v3/armored.png', import.meta.url).href, bounds: [12,12,384,257] },
    [EnemyType.SLOWER]: zombieSprite,
    [EnemyType.CYAN]: zombieSprite,
    [EnemyType.LEECH]: { url: new URL('../assets/enemies/v3/leech.png', import.meta.url).href, bounds: [12,12,384,77] },
    [EnemyType.BEETLE]: { url: new URL('../assets/enemies/v3/beetle.png', import.meta.url).href, bounds: [12,12,384,224] },
    [EnemyType.SPITTER]: { url: new URL('../assets/enemies/v3/spitter.png', import.meta.url).href, bounds: [12,12,384,260] },
    [EnemyType.JUMPER]: { url: new URL('../assets/enemies/v3/jumper.png', import.meta.url).href, bounds: [12,12,384,281] },
    [EnemyType.STEROID]: { url: new URL('../assets/enemies/v3/steroid.png', import.meta.url).href, bounds: [12,12,384,306] },
    [EnemyType.TENTACLE]: { url: new URL('../assets/enemies/v3/tentacle.png', import.meta.url).href, bounds: [12,12,384,225] },
    [EnemyType.WORM]: { url: new URL('../assets/enemies/v3/worm.png', import.meta.url).href, bounds: [12,12,384,134] },
    'fat-corpse': { url: new URL('../assets/enemies/v3/fat-corpse.png', import.meta.url).href, bounds: [12,12,384,344] },
    'tank-green': { url: new URL('../assets/enemies/v3/tank-green.png', import.meta.url).href, bounds: [12,12,384,355] },
    'fat-corpse-green': { url: new URL('../assets/enemies/v3/fat-corpse-green.png', import.meta.url).href, bounds: [12,12,384,341] },
};
type RasterEnemy = keyof typeof sprites;
// Calibrate the visible body, not the tips of long arms/legs. Collision radii
// describe the solid body; stretching the artwork must not inflate contact range.
const bodyScale: Partial<Record<RasterEnemy, number>> = {
    [EnemyType.GRUNT]: 1.25, [EnemyType.RUNNER]: 1.25,
    [EnemyType.SLOWER]: 1.25, [EnemyType.CYAN]: 1.25, [EnemyType.ARMORED]: 1.35,
    [EnemyType.BUG]: 1.5, [EnemyType.BEETLE]: 1.4, [EnemyType.JUMPER]: 1.2,
    [EnemyType.SPITTER]: 1.25, [EnemyType.TANK]: 1.2,
    'tank-green': 1.2, 'fat-corpse': 1.2, 'fat-corpse-green': 1.2,
    [EnemyType.LEECH]: 2.5,
};
const images = new Map<RasterEnemy, ReturnType<typeof createLazyImageAsset>>();
export type EnemyTint = 'ice' | 'fire';
const tintedSprites = new Map<string, HTMLCanvasElement>();
// Palette changes are baked once at preload; pose, texture and alpha stay identical.
const paletteFilters: Partial<Record<RasterEnemy, string>> = {
    [EnemyType.RUNNER]: 'hue-rotate(-35deg) saturate(2)',
    [EnemyType.SLOWER]: 'hue-rotate(65deg) saturate(1.5)',
    [EnemyType.CYAN]: 'hue-rotate(155deg) saturate(1.5)',
};
const margin = 10;
const maskPadding = 4;
let preparation: Promise<boolean[]> | undefined;

function prepareTint(type: RasterEnemy, image: HTMLImageElement, tint: EnemyTint | 'base'): void {
    const key = `${type}:${tint}`;
    if (tintedSprites.has(key)) return;
    const [x, y, width, height] = sprites[type].bounds;
    const canvas = document.createElement('canvas');
    canvas.width = width + (margin + maskPadding) * 2;
    canvas.height = height + (margin + maskPadding) * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Enemy mask canvas unavailable');
    ctx.filter = paletteFilters[type] ?? 'none';
    ctx.drawImage(image, margin + maskPadding - x, margin + maskPadding - y);
    ctx.filter = 'none';
    if (tint === 'base') {
        tintedSprites.set(key, canvas);
        return;
    }
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = tint === 'ice' ? 'rgba(100, 205, 255, 0.52)' : 'rgba(160, 20, 48, 0.52)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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

/** Explicit browser preload; imports stay inert in simulation. Failed masks can be retried. */
export function enemyArtReady(): Promise<boolean[]> {
    if (preparation) return preparation;
    const types = Object.keys(sprites) as RasterEnemy[];
    preparation = (async () => {
        const ready = await Promise.all(types.map(prepareImage));
        for (const [index, type] of types.entries()) {
            if (!ready[index]) continue;
            try {
                if (paletteFilters[type]) prepareTint(type, images.get(type)!.asset!.image, 'base');
                for (const tint of ['ice', 'fire'] as const) {
                    if (tintedSprites.has(`${type}:${tint}`)) continue;
                    await new Promise<void>(resolve => setTimeout(resolve, 0));
                    prepareTint(type, images.get(type)!.asset!.image, tint);
                }
            } catch { ready[index] = false; }
        }
        return ready;
    })().finally(() => { preparation = undefined; });
    return preparation;
}

function drawRaster(ctx: CanvasRenderingContext2D, type: RasterEnemy,
    x: number, y: number, radius: number, facing: number, gait: number, tint?: EnemyTint): boolean {
    const asset = images.get(type)?.asset;
    if (!asset?.loaded) return false;
    const [sourceX, sourceY, occupiedWidth, occupiedHeight] = sprites[type].bounds;
    const sourceWidth = occupiedWidth + margin * 2, sourceHeight = occupiedHeight + margin * 2;
    const scale = radius * 2 * (bodyScale[type] ?? 1) / occupiedWidth;
    const width = sourceWidth * scale, height = sourceHeight * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#0005';
    ctx.beginPath();
    ctx.ellipse(1, 3, radius * .92, radius * .65, facing, 0, Math.PI * 2);
    ctx.fill();
    const isLeech = type === EnemyType.LEECH;
    const isBug = type === EnemyType.BUG || type === EnemyType.BEETLE || type === EnemyType.JUMPER;
    ctx.rotate(facing + Math.sin(gait * (isBug ? 2 : 1)) * (isLeech ? .13 : isBug ? .06 : .025));
    const stretch = 1 + Math.sin(gait * 2) * (isLeech ? .09 : .025);
    ctx.scale(stretch, 1 / stretch);
    ctx.imageSmoothingEnabled = true;
    const mask = tintedSprites.get(`${type}:${tint ?? 'base'}`);
    ctx.drawImage(mask ?? asset.image, mask ? maskPadding : sourceX - margin, mask ? maskPadding : sourceY - margin, sourceWidth, sourceHeight,
        -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
}

export function drawEnemyArt(ctx: CanvasRenderingContext2D, type: EnemyType,
    x: number, y: number, radius: number, facing: number, gait: number, tint?: EnemyTint, variant = 0): boolean {
    return drawRaster(ctx, type === EnemyType.TANK && variant === 1 ? 'tank-green' : type, x, y, radius, facing, gait, tint);
}

/** Dedicated headless raster keeps the living enemy's cosmetic color variant. */
export function drawFatCorpse(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, variant = 0): boolean {
    return drawRaster(ctx, variant === 1 ? 'fat-corpse-green' : 'fat-corpse', x, y, radius, variant * 2.399963229728653, 0);
}
