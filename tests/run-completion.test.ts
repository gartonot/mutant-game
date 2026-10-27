import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameWorld } from '../src/systems/GameWorld';
import { Player } from '../src/entities/player/Player';
import type { PlayerController } from '../src/systems/Player/PlayerController';
import { WaveSystem } from '../src/systems/WaveSystem/WaveSystem';

test('four minute survival finishes exactly at zero and cannot continue advancing', () => {
    const player = new Player();
    const world = new GameWorld({ getPlayer: () => player } as PlayerController);
    assert.equal(world.remainingMs, 240000);
    assert.equal(world.isVictory, false);
    // Exercise the boundary without simulating unrelated combat.
    (world as unknown as { elapsed: number }).elapsed = 239999;
    assert.equal(world.remainingMs, 1);
    assert.equal(world.isVictory, false);
    world.update(16);
    assert.equal(world.remainingMs, 0);
    assert.equal(world.isVictory, true);
    world.update(1000);
    assert.equal(world.remainingMs, 0);
    player.currentHp = 0;
    assert.equal(world.isVictory, false, 'a dead player cannot win');
    const restarted = new GameWorld({ getPlayer: () => new Player() } as PlayerController);
    assert.equal(restarted.remainingMs, 240000);
});

test('a new boss is guaranteed every twelve waves even while earlier bosses remain alive', () => {
    const waves = new WaveSystem({ random: () => 0, viewport: () => ({ width: 800, height: 600 }) });
    const livingBosses = [];
    for (let wave = 1; wave <= 48; wave++) {
        const enemies = waves.spawnWave();
        const bosses = enemies.filter(enemy => enemy.radius === 40);
        assert.equal(bosses.length, wave % 12 === 0 ? 1 : 0, `wave ${wave}`);
        livingBosses.push(...bosses);
        assert.ok(livingBosses.every(boss => !boss.isDead));
        assert.equal(livingBosses.length, Math.floor(wave / 12));
        if (wave % 12 === 0) assert.equal(enemies.length, 8);
    }
});
