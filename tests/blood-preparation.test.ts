import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ZombieDeathEffect } from '../src/effects/ZombieDeathEffect';
import { GroundStampQueue } from '../src/effects/GroundStampQueue';
import type { PreparedBloodDecal } from '../src/effects/BloodDecalWorkerPool';

function recorder() {
    const calls: unknown[][] = [];
    const values: Record<string, unknown> = { globalAlpha: 1 };
    const context = new Proxy(values, {
        get: (target, key: string) => key in target ? target[key] : (...args: unknown[]) => calls.push([key, ...args]),
        set: (target, key: string, value) => { target[key] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    return { calls, context };
}

function preparedResult() {
    const released = { ground: 0, remains: 0 };
    const ground = { close() { released.ground++; } } as ImageBitmap;
    const atlas = { close() { released.remains++; } } as ImageBitmap;
    const result: PreparedBloodDecal = {
        canvas: ground, x: -30, y: -25,
        remains: { canvas: atlas, tiles: Array.from({ length: 14 }, (_, index) => ({
            sx: index * 60, width: 60, height: 60, left: -10, top: -10, resolution: 3,
        })) },
    };
    return { result, released, ground, atlas };
}

function createEffect(random = () => .5) {
    return new ZombieDeathEffect(80, 140, 25, .7, ['#630c13', '#a3131d', '#c51d26'], random);
}

test('pending blood preparation draws nothing and preserves the full animation lifetime', () => {
    const effect = createEffect();
    const trace = recorder();
    effect.deferUntilPrepared();
    effect.update(10000);
    effect.draw(trace.context);
    assert.equal(effect.isExpired, false);
    assert.equal(trace.calls.length, 0);
    const { result } = preparedResult();
    effect.acceptPrepared(result);
    effect.draw(trace.context);
    assert.ok(trace.calls.length > 0);
    effect.update(649);
    assert.equal(effect.isExpired, false);
    effect.update(1);
    assert.equal(effect.isExpired, true);
});

test('adopting prepared blood retains every original contour, trajectory and random decision', () => {
    let rngCalls = 0;
    let seed = 73;
    const effect = createEffect(() => {
        rngCalls++;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 2 ** 32;
    });
    const before = structuredClone(effect.groundInput(true));
    const callsBefore = rngCalls;
    effect.deferUntilPrepared();
    effect.update(500);
    const { result, atlas } = preparedResult();
    effect.acceptPrepared(result);
    assert.deepEqual(effect.groundInput(true), before);
    assert.equal(rngCalls, callsBefore);
    const trace = recorder();
    effect.draw(trace.context);
    const fragmentDraws = trace.calls.filter(call => call[0] === 'drawImage' && call[1] === atlas);
    assert.equal(fragmentDraws.length, 14);
    assert.equal(new Set(fragmentDraws.map(call => call[2])).size, 14);
});

test('expired blood releases its atlas exactly once while the queue owns its ground bitmap', () => {
    const effect = createEffect();
    const { result, released } = preparedResult();
    effect.acceptPrepared(result);
    effect.drawGround(recorder().context, result);
    effect.update(650);
    assert.equal(effect.isExpired, true);
    effect.dispose();
    effect.dispose();
    assert.deepEqual(released, { ground: 0, remains: 1 });
    const trace = recorder();
    effect.draw(trace.context);
    assert.equal(trace.calls.length, 0);
});

test('capping airborne blood before preparation still stamps the full ground and then frees both bitmaps', async () => {
    const effect = createEffect();
    const queue = new GroundStampQueue(() => 0);
    const { result, ground, atlas, released } = preparedResult();
    let complete!: (result: PreparedBloodDecal) => void;
    const promise = new Promise<PreparedBloodDecal>(resolve => { complete = resolve; });
    let accepted = false;
    effect.deferUntilPrepared();
    queue.enqueueAsync(promise, (ctx, value) => {
        effect.acceptPrepared(value);
        accepted = true;
        effect.drawGround(ctx, value);
    }, value => {
        value.canvas.close();
        if (!accepted) value.remains?.canvas.close();
    });
    effect.dispose();
    const trace = recorder();
    effect.draw(trace.context);
    assert.equal(trace.calls.length, 0);
    complete(result);
    await promise;
    queue.flush(trace.context);
    assert.equal(queue.pendingCount, 0);
    assert.equal(trace.calls.filter(call => call[0] === 'drawImage' && call[1] === ground).length, 1);
    assert.equal(trace.calls.filter(call => call[0] === 'drawImage' && call[1] === atlas).length, 14);
    assert.deepEqual(released, { ground: 1, remains: 1 });
    trace.calls.length = 0;
    effect.draw(trace.context);
    assert.equal(trace.calls.length, 0);
});

test('failed blood preparation unlocks the original fallback without consuming its animation', () => {
    const effect = createEffect();
    effect.deferUntilPrepared();
    effect.update(5000);
    effect.acceptPrepared(null);
    const trace = recorder();
    effect.draw(trace.context);
    assert.ok(trace.calls.length > 0);
    effect.update(649);
    assert.equal(effect.isExpired, false);
    effect.update(1);
    assert.equal(effect.isExpired, true);
});
