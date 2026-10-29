import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EnemyType } from '../src/entities/enemy/EnemyType';

test('enemy tint preparation retries failures, shares work and keeps allocation out of drawing', async t => {
    // Isolate the browser cache: simulation suites share a bundle and expect no loaded artwork.
    const { build } = createRequire(resolve('package.json'))('esbuild');
    const bundle = await build({ entryPoints: ['src/rendering/EnemyArt.ts'], bundle: true,
        platform: 'node', format: 'esm', write: false, tsconfig: 'tsconfig.json',
        define: { 'import.meta.url': JSON.stringify(pathToFileURL(resolve('src/rendering/EnemyArt.ts')).href) } });
    const { drawEnemyArt, enemyArtReady } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
    const originals = new Map(['Image', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    let imageCount = 0;
    let decodeCount = 0;
    let failContext = true;
    const canvases: { width: number; height: number; context: ReturnType<typeof makeContext> | null }[] = [];
    function makeContext() {
        return {
            draws: [] as unknown[][],
            fills: [] as unknown[][],
            fillStyle: '', globalCompositeOperation: '', imageSmoothingEnabled: false,
            drawImage(...args: unknown[]) { this.draws.push(args); },
            fillRect(...args: unknown[]) { this.fills.push(args); },
            getImageData() { return { data: new Uint8ClampedArray(4) }; },
            stroke() {}, moveTo() {}, lineTo() {}, closePath() {}, save() {}, restore() {}, translate() {}, beginPath() {}, ellipse() {}, fill() {}, rotate() {}, scale() {},
        };
    }
    class MockImage {
        naturalWidth = 1254;
        naturalHeight = 1254;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor() { imageCount++; }
        set src(_url: string) { queueMicrotask(() => this.onload?.()); }
        async decode() { decodeCount++; }
    }
    Object.defineProperty(globalThis, 'Image', { configurable: true, value: MockImage });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        createElement(name: string) {
            assert.equal(name, 'canvas');
            const canvas = { width: 0, height: 0, context: null as ReturnType<typeof makeContext> | null,
                getContext(kind: string) {
                    assert.equal(kind, '2d');
                    if (failContext) { failContext = false; return null; }
                    return this.context ??= makeContext();
                },
            };
            canvases.push(canvas);
            return canvas;
        },
    } });
    try {
        await t.test('concurrent preparations share the same attempt and failed masks are retryable', async () => {
            assert.equal(canvases.length, 0);
            const first = enemyArtReady();
            assert.equal(enemyArtReady(), first);
            const result = await first;
            assert.equal(result.length, 18, '15 enemy types, second fat color and two headless corpses');
            assert.deepEqual(result, [false, ...Array(17).fill(true)]);
            assert.equal(imageCount, 18);
            assert.equal(decodeCount, 18);
            assert.deepEqual(await enemyArtReady(), Array(18).fill(true));
            assert.equal(imageCount, 18, 'retry reuses decoded source images');
            assert.equal(canvases.length, 40, '36 status masks, three palettes and one failed allocation');
        });
        await t.test('all masks retain native crop pixels and filter padding before the first draw', () => {
            const masks = canvases.filter(canvas => canvas.context?.fills.length);
            assert.equal(masks.length, 36);
            assert.equal(masks.filter(c => c.width === 738 && c.height === 695).length, 8, 'four zombie palettes share the original crop');
            assert.equal(masks.filter(c => c.width === 412).length, 28, 'other sprites use 384px occupied width with padding');
            for (const canvas of masks) {
                const ctx = canvas.context!;
                assert.equal(ctx.draws.length, 1);
                assert.equal(ctx.draws[0].length, 3, 'native-size image translation, no resize');
                assert.equal(ctx.globalCompositeOperation, 'source-atop');
                assert.deepEqual(ctx.fills, [[0, 0, canvas.width, canvas.height]]);
            }
            assert.equal(masks.filter(c => c.context!.fillStyle === 'rgba(100, 205, 255, 0.52)').length, 18);
            assert.equal(masks.filter(c => c.context!.fillStyle === 'rgba(160, 20, 48, 0.52)').length, 18);
        });
        await t.test('repeated preparation and 600 effect draws reuse masks without canvas allocation', async () => {
            const count = canvases.length;
            await enemyArtReady();
            const context = makeContext();
            const types = [EnemyType.GRUNT, EnemyType.TANK, EnemyType.BOSS];
            for (let i = 0; i < 600; i++) {
                assert.equal(drawEnemyArt(context as unknown as CanvasRenderingContext2D,
                    types[i % 3], 100, 100, 25, i / 10, .7, i % 2 ? 'ice' : 'fire'), true);
            }
            assert.equal(canvases.length, count);
            assert.equal(context.draws.length, 600);
            for (const draw of context.draws) {
                assert.ok(canvases.includes(draw[0] as typeof canvases[number]));
                assert.deepEqual(draw.slice(1, 3), [4, 4], 'draw uses inner region with filtering guard');
            }
        });
        await t.test('new silhouettes and all status variants are prepared once before gameplay', () => {
            const count = canvases.length;
            const context = makeContext();
            for (let repeat = 0; repeat < 20; repeat++) {
                for (const type of [EnemyType.GRUNT, EnemyType.TANK, EnemyType.BUG, EnemyType.RUNNER, EnemyType.ARMORED,
                    EnemyType.SLOWER, EnemyType.CYAN, EnemyType.LEECH, EnemyType.BEETLE, EnemyType.SPITTER, EnemyType.JUMPER,
                    EnemyType.BOSS, EnemyType.STEROID, EnemyType.TENTACLE, EnemyType.WORM]) {
                    for (const tint of [undefined, 'ice', 'fire']) {
                        assert.equal(drawEnemyArt(context, type, 10, 20, 25, 0, 0, tint), true);
                    }
                }
            }
            assert.equal(canvases.length, count);
            assert.equal(new Set(context.draws.map(draw => draw[0])).size, 45);
        });
        await t.test('fat color is selected by a stable cosmetic variant, independent of movement', () => {
            const context = makeContext();
            const count = canvases.length;
            drawEnemyArt(context, EnemyType.TANK, 10, 20, 25, 0, 0, undefined, 1);
            drawEnemyArt(context, EnemyType.TANK, 110, 220, 25, 1, 2, undefined, 1);
            drawEnemyArt(context, EnemyType.TANK, 10, 20, 25, 0, 0, undefined, 0);
            assert.equal(context.draws[0][0], context.draws[1][0]);
            assert.notEqual(context.draws[0][0], context.draws[2][0]);
            assert.equal(canvases.length, count);
        });
    } finally {
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    }
});
