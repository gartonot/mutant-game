import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Player } from '../src/entities/player/Player';
import type { Enemy } from '../src/entities/enemy/Enemy';
import { isBossType } from '../src/entities/enemy/EnemyType';
import { resetArena } from '../src/gameplay/Arena';
import { GameWorld } from '../src/systems/GameWorld';
import type { PlayerController } from '../src/systems/Player/PlayerController';
import { TEMPORARY_WAVE_SIZE } from '../src/systems/WaveSystem/WaveConfig';

test('hard-mode runtime releases the complete opening crowd within one second without advancing the first boss', () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { innerWidth: 1200, innerHeight: 800 } });
    resetArena();
    const player = new Player(600, 400);
    player.currentHp = 1e9;
    const controller = {
        getPlayer: () => player, update() {}, getBullets: () => [], cleanupBullets() {},
        getAimPosition: () => ({ x: 600, y: 400 }), registerKill() {}, acquiredAmmoCategories: [], isMoving: false,
    } as unknown as PlayerController;
    const world = new GameWorld(controller, () => .5, [], []);
    const state = world as unknown as { enemies: Enemy[] };
    try {
        world.update(2999);
        assert.equal(state.enemies.length, 0, 'opening delay must remain unchanged');
        world.update(1);
        assert.ok(state.enemies.length > 0, 'the first wave begins at three seconds');
        for (let i = 0; i < 10; i++) world.update(100);
        assert.equal(state.enemies.length, TEMPORARY_WAVE_SIZE, 'the complete opening crowd must arrive by four seconds');
        assert.equal(state.enemies.filter(enemy => isBossType(enemy.type)).length, 0);
        for (let time = 4000; time < 59000; time += 1000) world.update(1000);
        assert.equal(state.enemies.filter(enemy => isBossType(enemy.type)).length, 0, 'no boss before the first minute');
        world.update(1000);
        assert.equal(state.enemies.filter(enemy => isBossType(enemy.type)).length, 1, 'first boss keeps its minute mark');
    } finally {
        world.dispose(); resetArena();
        if (previous) Object.defineProperty(globalThis, 'window', previous);
        else Reflect.deleteProperty(globalThis, 'window');
    }
});
