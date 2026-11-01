import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARENA_BORDER, configureArena, getArenaSize, resetArena } from '../src/gameplay/Arena';
import { EnemyType } from '../src/entities/enemy/EnemyType';
import { WaveSystem } from '../src/systems/WaveSystem/WaveSystem';
import { constrainPlayerToArena } from '../src/systems/spatial/playerBounds';

test('camera-relative waves appear just outside the visible rectangle, inside the map walls', () => {
    configureArena(1200, 800);
    try {
        const viewport = { x: 1200, y: 800, width: 1200, height: 800 };
        for (const roll of [0.05, 0.3, 0.55, 0.8]) {
            const waves = new WaveSystem({ random: () => roll, viewport: () => viewport,
                rules: [{ types: [EnemyType.GRUNT], count: 1 }] });
            const [enemy] = waves.spawnWave();
            assert.ok(enemy.x < viewport.x || enemy.x > viewport.x + viewport.width ||
                enemy.y < viewport.y || enemy.y > viewport.y + viewport.height);
            assert.ok(enemy.x >= ARENA_BORDER + enemy.radius);
            assert.ok(enemy.y >= ARENA_BORDER + enemy.radius);
            assert.ok(enemy.x <= 3600 - ARENA_BORDER - enemy.radius);
            assert.ok(enemy.y <= 2400 - ARENA_BORDER - enemy.radius);
        }
    } finally { resetArena(); }
});

test('waves use an open ingress edge when the camera touches the outer wall', () => {
    configureArena(1200, 800);
    try {
        const waves = new WaveSystem({ random: () => 0.55,
            viewport: () => ({ x: 0, y: 0, width: 1200, height: 800 }),
            rules: [{ types: [EnemyType.GRUNT], count: 1 }] });
        const [enemy] = waves.spawnWave();
        assert.ok(enemy.x > 1200, 'left-side spawn moves to the opposite, offscreen side');
        assert.ok(enemy.x < getArenaSize().width - ARENA_BORDER - enemy.radius);
    } finally { resetArena(); }
});

test('world boundaries include the concrete wall thickness and the complete body radius', () => {
    const body = { x: -100, y: 2500, radius: 20 };
    constrainPlayerToArena(body, 3600, 2400, ARENA_BORDER);
    assert.equal(body.x, 52);
    assert.equal(body.y, 2348);
    // Legacy callers retain radius-only clipping.
    body.x = -100; body.y = 2500;
    constrainPlayerToArena(body, 3600, 2400);
    assert.equal(body.x, 20); assert.equal(body.y, 2380);
});
