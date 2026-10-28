import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Enemy } from '../src/entities/enemy/Enemy';

const frame = 1000 / 60;
function tick(enemy: Enemy, frames: number): void {
    for (let i = 0; i < frames; i++) enemy.update(frame);
}

test('fear sends enemies outward with animated movement and prevents contact attacks', () => {
    const enemy = new Enemy(500, 300);
    enemy.setTarget(400, 300);
    enemy.applyFear(5000, 400, 300);
    tick(enemy, 60);
    assert.ok(Math.hypot(enemy.x - 400, enemy.y - 300) > 180);
    assert.equal(enemy.canDamage(1000), false);
    const before = enemy.x;
    enemy.receiveDamage(.1, 0, 20);
    assert.equal(enemy.x, before + 20, 'scared enemies still react to weapon impacts');
});

test('fear resumes pursuit smoothly after expiration', () => {
    const enemy = new Enemy(500, 300);
    enemy.setTarget(400, 300);
    enemy.applyFear(200, 400, 300);
    tick(enemy, 14);
    assert.equal(enemy.isFeared, false);
    const distance = Math.hypot(enemy.x - 400, enemy.y - 300);
    tick(enemy, 100);
    assert.ok(Math.hypot(enemy.x - 400, enemy.y - 300) < distance - 40);
    assert.equal(enemy.canDamage(3000), true);
});

test('fear respects frozen speed, slow effects and damage over time', () => {
    const frozen = new Enemy(500, 300);
    frozen.speed = 0; frozen.applyFear(5000, 400, 300);
    tick(frozen, 20);
    assert.equal(frozen.x, 500); assert.equal(frozen.y, 300);
    const normal = new Enemy(500, 300), slow = new Enemy(500, 300);
    normal.applyFear(5000, 400, 300); slow.applyFear(5000, 400, 300);
    slow.applyEffect({ slowMs: 2000, slowFactor: .3 });
    tick(normal, 60); tick(slow, 60);
    assert.ok(Math.hypot(slow.x - 500, slow.y - 300) < Math.hypot(normal.x - 500, normal.y - 300) * .4);
    frozen.applyEffect({ burnMs: 1000, burnDps: 1000 });
    tick(frozen, 60);
    assert.equal(frozen.isDead, true);
});

test('coincident fear origin yields a finite escape direction', () => {
    const enemy = new Enemy(400, 300);
    enemy.applyFear(1000, 400, 300);
    tick(enemy, 10);
    assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.y));
    assert.ok(Math.hypot(enemy.x - 400, enemy.y - 300) > 5);
});

test('scared runners remain inside the arena and continue moving along walls', () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { innerWidth: 800, innerHeight: 600 } });
    try {
        for (const [x, y] of [[755, 300], [45, 300], [400, 45], [400, 555], [755, 555]]) {
            const enemy = new Enemy(x, y);
            enemy.applyFear(5000, 400, 300);
            let distance = 0;
            for (let frameIndex = 0; frameIndex < 280; frameIndex++) {
                const beforeX = enemy.x, beforeY = enemy.y;
                enemy.update(frame);
                distance += Math.hypot(enemy.x - beforeX, enemy.y - beforeY);
                assert.ok(enemy.x >= 33 && enemy.x <= 767 && enemy.y >= 33 && enemy.y <= 567);
            }
            assert.ok(distance > 300, 'wall steering must not leave a runner stuck');
        }
    } finally {
        if (previous) Object.defineProperty(globalThis, 'window', previous);
        else Reflect.deleteProperty(globalThis, 'window');
    }
});
