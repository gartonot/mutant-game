import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameWorld } from '../src/systems/GameWorld';
import { Player } from '../src/entities/player/Player';
import type { PlayerController } from '../src/systems/Player/PlayerController';
import { WaveConfigs } from '../src/systems/WaveSystem/WaveConfig';
import { WaveSystem } from '../src/systems/WaveSystem/WaveSystem';

test('six minute survival finishes exactly at zero and cannot continue advancing', () => {
    const player = new Player();
    const world = new GameWorld({ getPlayer: () => player } as PlayerController);
    assert.equal(world.remainingMs, 360000);
    assert.equal(world.isVictory, false);
    // Exercise the boundary without simulating unrelated combat.
    (world as unknown as { elapsed: number }).elapsed = 240000;
    assert.equal(world.remainingMs, 120000);
    assert.equal(world.isVictory, false, 'four minutes no longer ends the run');
    (world as unknown as { elapsed: number }).elapsed = 359999;
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
    assert.equal(restarted.remainingMs, 360000);
});
