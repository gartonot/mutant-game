import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Enemy } from '../src/entities/enemy/Enemy';
import { EnemySeparation } from '../src/systems/spatial/EnemySeparation';

function body(x: number, y: number, radius = 25, isFeared = false): Enemy {
    return { x, y, radius, isFeared, speed: 1 } as Enemy;
}

test('a dense pursuing crowd settles without sustained multi-pixel shaking', () => {
    const enemies = Array.from({ length: 100 }, (_, i) =>
        body((i % 10 - 4.5) * 35, (Math.floor(i / 10) - 4.5) * 35));
    const separation = new EnemySeparation();
    let largestStep = 0, totalMovement = 0, samples = 0;
    for (let tick = 0; tick < 1800; tick++) {
        const previous = enemies.map(({ x, y }) => ({ x, y }));
        for (const enemy of enemies) {
            const distance = Math.hypot(enemy.x, enemy.y);
            const step = Math.min(1, distance);
            if (distance > 0) {
                enemy.x -= enemy.x / distance * step;
                enemy.y -= enemy.y / distance * step;
            }
        }
        separation.resolve(enemies);
        if (tick < 1200) continue;
        for (let i = 0; i < enemies.length; i++) {
            const distance = Math.hypot(enemies[i].x - previous[i].x, enemies[i].y - previous[i].y);
            largestStep = Math.max(largestStep, distance);
            totalMovement += distance;
            samples++;
        }
    }
    assert.ok(largestStep < 2, `settled crowd jumped ${largestStep.toFixed(3)} px in one tick`);
    assert.ok(totalMovement / samples < .25,
        `settled crowd kept moving ${(totalMovement / samples).toFixed(3)} px per tick on average`);
});

test('separation clears a mixed-radius overlap without moving the pair center', () => {
    const enemies = [body(-17.5, 0, 15), body(17.5, 0, 40)];
    new EnemySeparation().resolve(enemies);
    assert.ok(enemies[1].x - enemies[0].x >= 55 - 1e-6);
    assert.ok(Math.abs(enemies[0].x + enemies[1].x) < 1e-6);
    assert.equal(enemies[0].y, 0);
    assert.equal(enemies[1].y, 0);
});

test('frightened enemies separate normally instead of becoming fixed crowd blockers', () => {
    const scared = body(0, 0, 25, true), mobile = body(10, 0);
    new EnemySeparation().resolve([scared, mobile]);
    assert.ok(scared.x < 0);
    assert.ok(mobile.x > 10);
    assert.ok(Math.hypot(mobile.x - scared.x, mobile.y - scared.y) >= 50 - 1e-6);
});

test('sandbox frozen enemies stay fixed during separation', () => {
    const frozen = body(0, 0), mobile = body(10, 0);
    frozen.speed = 0;
    const separation = new EnemySeparation();
    for (let tick = 0; tick < 3; tick++) separation.resolve([frozen, mobile]);
    assert.equal(frozen.x, 0);
    assert.ok(mobile.x >= 50 - 1e-6);
});
