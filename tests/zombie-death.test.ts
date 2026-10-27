import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType } from '../src/entities/enemy/EnemyType';
import { ZombieDeathEffect } from '../src/effects/ZombieDeathEffect';

test('airborne death particles expire while the ground imprint stays unchanged', () => {
    const effect = new ZombieDeathEffect(100, 100, 25, 0, ['#630c13', '#a3131d', '#c51d26'], () => .5);
    const calls: unknown[][] = [];
    const ctx = new Proxy({}, { get: (_target, key) => (...args: unknown[]) => calls.push([key, ...args]),
        set: () => true }) as CanvasRenderingContext2D;
    effect.drawGround(ctx);
    const initial = calls.slice();
    effect.update(10000);
    assert.equal(effect.isExpired, true);
    calls.length = 0;
    effect.drawGround(ctx);
    assert.deepEqual(calls, initial);
});

test('death burst preserves lethal shot direction and impact origin, and cannot be overwritten', () => {
    const enemy = new Enemy(100, 80);
    enemy.receiveDamage(2, Math.PI / 2, 10);
    const burst = enemy.deathBurst!;
    assert.equal(burst.x, 100); assert.equal(burst.y, 80);
    assert.equal(burst.angle, Math.PI / 2);
    enemy.receiveDamage(2, Math.PI, 10);
    assert.deepEqual(enemy.deathBurst, burst);
});

test('burn death remembers the flame direction; reinforced zombies use green blood', () => {
    const enemy = new Enemy(100, 80);
    enemy.receiveDamage(0, -Math.PI / 2, 0);
    enemy.applyEffect({ burnDps: 10, burnMs: 1000 });
    enemy.update(300);
    assert.equal(enemy.deathBurst!.angle, -Math.PI / 2);
    const tank = new Enemy(0, 0, EnemyType.TANK);
    tank.receiveDamage(99, 0);
    assert.deepEqual(enemy.deathBurst!.palette, ['#630c13', '#a3131d', '#c51d26']);
    assert.deepEqual(tank.deathBurst!.palette, ['#243b17', '#4d702b', '#79a044']);
    const boss = new Enemy(0, 0, EnemyType.BOSS);
    boss.receiveDamage(99, 0);
    assert.deepEqual(boss.deathBurst!.palette, ['#630c13', '#a3131d', '#c51d26']);
});
