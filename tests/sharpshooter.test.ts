import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameWorld } from '../src/systems/GameWorld';
import { Player } from '../src/entities/player/Player';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType } from '../src/entities/enemy/EnemyType';
import { PlayerStatsController } from '../src/systems/Player/PlayerStatsController';
import type { PlayerController } from '../src/systems/Player/PlayerController';
import { achievements, bonusesOf, emptyTotals, levelOf, ProgressStore } from '../src/progression/Achievements';

function scenario(hits = 70, shots = 100, bosses = 4) {
    const player = new Player();
    const stats = new PlayerStatsController();
    stats.registerShot(shots);
    for (let i = 0; i < shots; i++) i < hits ? stats.registerHit() : stats.registerMiss();
    const controller = { getPlayer: () => player, getStats: () => stats.snapshot(),
        registerKill: () => stats.registerKill(), acquiredAmmoCategories: [] } as unknown as PlayerController;
    const world = new GameWorld(controller, () => .999, [], []);
    const state = world as unknown as { elapsed: number; enemies: Enemy[]; processEnemyDeaths(): void };
    state.enemies = Array.from({ length: bosses }, () => {
        const enemy = new Enemy(0, 0, EnemyType.BOSS);
        // A resolved death without visual effects keeps this test independent of Canvas.
        (enemy as unknown as { isDeadFlag: boolean }).isDeadFlag = true;
        return enemy;
    });
    state.processEnemyDeaths();
    state.processEnemyDeaths();
    state.elapsed = GameWorld.DURATION_MS;
    return { world, state, player };
}

test('sharpshooter requires victory, all four bosses and at least 70 percent exact accuracy', () => {
    const passed = scenario();
    assert.equal(passed.world.getRunStats().sharpshooterWins, 1);
    passed.state.elapsed--;
    assert.equal(passed.world.getRunStats().sharpshooterWins, 0, 'unfinished run');
    passed.state.elapsed++;
    passed.player.currentHp = 0;
    assert.equal(passed.world.getRunStats().sharpshooterWins, 0, 'dead player');
    assert.equal(scenario(70, 100, 3).world.getRunStats().sharpshooterWins, 0, 'one boss remains');
    const rounded = scenario(139, 200).world.getRunStats();
    assert.equal(rounded.accuracy, 70);
    assert.equal(rounded.sharpshooterWins, 0, '69.5 percent must not qualify through rounding');
    assert.equal(scenario(0, 0).world.getRunStats().sharpshooterWins, 0, 'no shots');
});

test('sharpshooter persists, grants one percent damage and loads older saves without the counter', t => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    let saved = JSON.stringify({ kills: 42, games: 2 });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; },
    } });
    t.after(() => previous ? Object.defineProperty(globalThis, 'localStorage', previous)
        : Reflect.deleteProperty(globalThis, 'localStorage'));
    const store = new ProgressStore();
    assert.equal(store.totals.sharpshooterWins, 0);
    assert.equal(store.totals.kills, 42);
    store.record(scenario().world.getRunStats());
    const loaded = new ProgressStore();
    const award = achievements.find(a => a.id === 'sharpshooter')!;
    assert.equal(levelOf(award, loaded.totals), 1);
    assert.equal(bonusesOf(loaded.totals).damage, .01);
    assert.equal(bonusesOf({ ...emptyTotals(), sharpshooterWins: 2 }).damage, .01,
        'only the first original tier is known');
});
