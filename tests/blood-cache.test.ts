import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ZombieDeathEffect } from '../src/effects/ZombieDeathEffect';
import { ZombieDeathEffect as OriginalEffect } from '../scripts/bench/ZombieDeathEffect.before-optimization';

function random(seed: number) {
    let calls = 0;
    return { next: () => { calls++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; },
        get calls() { return calls; } };
}
function recorder() {
    const calls: unknown[][] = [];
    const values: Record<string, unknown> = { globalAlpha: 1 };
    const context = new Proxy(values, {
        get: (target, key: string) => key in target ? target[key] : (...args: unknown[]) => { calls.push([key, ...args]); },
        set: (target, key: string, value) => { target[key] = value; calls.push(['set', key, value]); return true; },
    }) as unknown as CanvasRenderingContext2D;
    return { context, calls };
}
const red = ['#630c13', '#a3131d', '#c51d26'];
const green = ['#243b17', '#4d702b', '#79a044'];

test('death optimization preserves original random sequence, unique contours and flight parameters', () => {
    for (const palette of [red, green]) for (const radius of [25, 40]) for (const seed of [1, 73, 9182]) {
        const beforeRandom = random(seed), afterRandom = random(seed);
        const before = new OriginalEffect(80, 140, radius, 1.7, palette, beforeRandom.next);
        const after = new ZombieDeathEffect(80, 140, radius, 1.7, palette, afterRandom.next);
        const beforeState = before as unknown as Record<string, unknown>;
        const afterState = after as unknown as Record<string, unknown>;
        for (const field of ['particles', 'groundShapes', 'trails', 'bloodColor', 'greenBlood', 'drag', 'lifetimeMs']) {
            assert.deepEqual(afterState[field], beforeState[field], field);
        }
        assert.equal(afterRandom.calls, beforeRandom.calls);
        const particles = afterState.particles as { chunk: boolean; contour: Float64Array }[];
        assert.equal(particles.length, 105);
        const chunks = particles.filter(p => p.chunk);
        assert.equal(chunks.length, 14);
        assert.equal(new Set(chunks.map(p => Array.from(p.contour).join(','))).size, 14);
    }
});

test('without DOM the original vector fallback preserves ground and airborne commands', () => {
    assert.equal(typeof document, 'undefined');
    for (const palette of [red, green]) for (const age of [0, 120, 350, 600, 650]) {
        const before = new OriginalEffect(80, 140, 40, 1.7, palette, random(73).next);
        const after = new ZombieDeathEffect(80, 140, 40, 1.7, palette, random(73).next);
        before.update(age); after.update(age);
        for (const method of ['drawGround', 'draw'] as const) {
            const expected = recorder(), actual = recorder();
            before[method](expected.context); after[method](actual.context);
            assert.deepEqual(actual.calls, expected.calls, `${method} age=${age}`);
        }
    }
});

test('one unique remains atlas is reused by flying and ground particles without further randomness', t => {
    const canvases: { width: number; height: number; getContext: () => CanvasRenderingContext2D }[] = [];
    t.after(() => Reflect.deleteProperty(globalThis, 'document'));
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => {
        const trace = recorder();
        const canvas = { width: 0, height: 0, getContext: () => trace.context };
        trace.context.getImageData = () => ({ data: new Uint8ClampedArray(canvas.width * canvas.height * 4) }) as ImageData;
        canvases.push(canvas);
        return canvas;
    } } });
    const rng = random(73);
    const effect = new ZombieDeathEffect(80, 140, 40, 1.7, green, rng.next);
    const rngCalls = rng.calls;
    const { context, calls } = recorder();
    effect.draw(context);
    assert.equal(canvases.length, 1);
    const atlas = canvases[0];
    assert.ok(atlas.width > 0 && atlas.height > 0);
    const cachedDraws = calls.filter(call => call[0] === 'drawImage' && call[1] === atlas);
    assert.equal(cachedDraws.length, 14);
    assert.equal(new Set(cachedDraws.map(call => call[2])).size, 14);
    effect.update(100);
    effect.draw(context);
    effect.drawGround(context);
    assert.equal(canvases.length, 2, 'only one additional canvas for the permanent ground decal');
    effect.drawGround(context);
    effect.draw(context);
    assert.equal(canvases.length, 2);
    assert.equal(rng.calls, rngCalls);
    effect.update(1000);
    calls.length = 0;
    effect.draw(context);
    assert.equal(calls.length, 0);
});

test('failed atlas context falls back to original vectors and is not retried every frame', t => {
    let allocations = 0;
    t.after(() => Reflect.deleteProperty(globalThis, 'document'));
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => {
        allocations++;
        return { width: 0, height: 0, getContext: () => null };
    } } });
    const before = new OriginalEffect(80, 140, 25, .5, red, random(5).next);
    const after = new ZombieDeathEffect(80, 140, 25, .5, red, random(5).next);
    for (let i = 0; i < 3; i++) {
        before.update(50); after.update(50);
        const expected = recorder(), actual = recorder();
        before.draw(expected.context); after.draw(actual.context);
        assert.deepEqual(actual.calls, expected.calls);
    }
    assert.equal(allocations, 1);
});
