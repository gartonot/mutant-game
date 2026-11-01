import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrdinaryEnemyMechanics } from '../src/gameplay/OrdinaryEnemyMechanics';
import { ZombieDeathEffect } from '../src/effects/ZombieDeathEffect';
import { Enemy } from '../src/entities/enemy/Enemy';

const view = { x: 0, y: 0, width: 100, height: 100 };
function recorder() {
    const calls: unknown[][] = [];
    const values: Record<string, unknown> = { globalAlpha: 1 };
    const ctx = new Proxy(values, {
        get: (target, key: string) => key in target ? target[key] : (...args: unknown[]) => calls.push([key, ...args]),
        set: (target, key: string, value) => { target[key] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, calls, paints: () => calls.filter(call => ['fill', 'stroke', 'drawImage'].includes(String(call[0]))).length };
}
function effectsAt(x: number) {
    const mechanics = new OrdinaryEnemyMechanics();
    const state = mechanics as unknown as {
        corpses: { x: number; y: number; radius: number; hits: number; age: number; variant: number }[];
        globs: { x: number; y: number; vx: number; vy: number; life: number; radius: number }[];
        stains: { x: number; y: number; radius: number; age: number; seed: number }[];
        jumps: Map<Enemy, { phase: 'windup'; elapsed: number; fromX: number; fromY: number; toX: number; toY: number; hit: boolean }>;
    };
    state.corpses.push({ x, y: 50, radius: 30, hits: 0, age: 0, variant: 0 });
    state.globs.push({ x, y: 50, vx: 0, vy: 0, life: 100, radius: 8 });
    state.stains.push({ x, y: 50, radius: 20, age: 150, seed: 0 });
    state.jumps.set(new Enemy(x, 50), { phase: 'windup', elapsed: 0, fromX: x, fromY: 50, toX: x, toY: 50, hit: false });
    return mechanics;
}

test('ordinary effects skip offscreen painting without changing their simulation state', () => {
    const mechanics = effectsAt(1000);
    const drawing = recorder();
    mechanics.drawGround(drawing.ctx, view); mechanics.draw(drawing.ctx, view);
    assert.equal(drawing.paints(), 0);
    assert.equal(mechanics.corpseCount, 1); assert.equal(mechanics.projectileCount, 1); assert.equal(mechanics.greenMarkCount, 1);
    const uncull = recorder(); mechanics.drawGround(uncull.ctx); mechanics.draw(uncull.ctx);
    assert.ok(uncull.paints() > 0, 'offscreen effects remain drawable after the camera moves');
});

test('onscreen effects retain every paint command and partially visible extents are not discarded', () => {
    for (const x of [50, 108]) {
        const mechanics = effectsAt(x);
        const before = recorder(), after = recorder();
        mechanics.drawGround(before.ctx); mechanics.draw(before.ctx);
        mechanics.drawGround(after.ctx, view); mechanics.draw(after.ctx, view);
        assert.deepEqual(after.calls, before.calls, `effect extent at x=${x}`);
    }
});

test('death spray culls distant effects but retains particles whose origin lies outside the viewport', () => {
    const far = new ZombieDeathEffect(3000, 3000, 25, 0, ['#703733'], () => .5);
    const farDrawing = recorder(); far.update(100); far.draw(farDrawing.ctx, view);
    assert.equal(farDrawing.calls.length, 0);
    const edge = new ZombieDeathEffect(200, 50, 25, Math.PI, ['#703733'], () => .9);
    edge.update(100);
    const before = recorder(), after = recorder();
    edge.draw(before.ctx); edge.draw(after.ctx, view);
    assert.ok(after.paints() > 0);
    assert.deepEqual(after.calls, before.calls, 'airborne spread must remain intact near screen edges');
});
