import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType, isZombieType } from '../src/entities/enemy/EnemyType';
import { Player } from '../src/entities/player/Player';
import { achievements, bonusesOf, levelOf, ProgressStore } from '../src/progression/Achievements';
import { GameWorld } from '../src/systems/GameWorld';
import type { PlayerController } from '../src/systems/Player/PlayerController';
import { PlayerStatsController } from '../src/systems/Player/PlayerStatsController';

test('zombie exterminator counts the six zombie variants', () => {
    for (const type of [EnemyType.GRUNT, EnemyType.RUNNER, EnemyType.ARMORED, EnemyType.SLOWER, EnemyType.CYAN, EnemyType.TANK]) {
        assert.equal(isZombieType(type), true, type);
    }
    for (const type of [EnemyType.BUG, EnemyType.LEECH, EnemyType.BEETLE, EnemyType.SPITTER, EnemyType.JUMPER,
        EnemyType.BOSS, EnemyType.STEROID, EnemyType.TENTACLE, EnemyType.WORM]) {
        assert.equal(isZombieType(type), false, type);
    }
});

test('a mixed run credits each dead zombie once and awards the level when recorded', () => {
    const player = new Player();
    const stats = new PlayerStatsController();
    const controller = { getPlayer: () => player, getStats: () => stats.snapshot(),
        registerKill: () => stats.registerKill(), acquiredAmmoCategories: [] } as unknown as PlayerController;
    const world = new GameWorld(controller, () => .999, [], []);
    const state = world as unknown as { enemies: Enemy[]; processEnemyDeaths(): void };
    const tank = new Enemy(0, 0, EnemyType.TANK);
    const bug = new Enemy(0, 0, EnemyType.BUG);
    state.enemies.push(tank, bug, new Enemy(0, 0, EnemyType.GRUNT));
    tank.receiveDamage(100);
    bug.receiveDamage(100);
    state.processEnemyDeaths();
    state.processEnemyDeaths();
    const run = world.getRunStats();
    assert.equal(run.kills, 2);
    assert.equal(run.zombieKills, 1);

    const store = new ProgressStore();
    store.totals.zombieKills = 4999;
    const award = achievements.find(a => a.id === 'zombie-exterminator')!;
    const { before, after } = store.record(run);
    assert.equal(award.tracking, 'active');
    assert.equal(levelOf(award, before), 0);
    assert.equal(levelOf(award, after), 1);
    assert.equal(bonusesOf(after).normalAmmo, .03);
});
