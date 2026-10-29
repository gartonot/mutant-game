import assert from 'node:assert/strict';
import test from 'node:test';
import { GameWorld } from '../src/systems/GameWorld';
import { Player } from '../src/entities/player/Player';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType, isBossType } from '../src/entities/enemy/EnemyType';
import type { PlayerController } from '../src/systems/Player/PlayerController';
import type { BossEncounter } from '../src/gameplay/BossEncounter';

function runWorld(run: (f: ReturnType<typeof fixture>) => void) {
    const previous = globalThis.window;
    globalThis.window = { innerWidth: 1000, innerHeight: 800 } as Window & typeof globalThis;
    try { run(fixture()); } finally { globalThis.window = previous; }
}
function fixture() {
    const player = new Player(500, 400); player.damageReduction = 1;
    let kills = 0, updates = 0;
    const controller = { getPlayer: () => player, getAimPosition: () => ({ x: 800, y: 400 }),
        update: (dt: number) => { updates++; player.updateEnemyEffects(dt); }, getBullets: () => [],
        cleanupBullets: () => {}, registerKill: () => kills++, acquiredAmmoCategories: [], isMoving: false,
    } as unknown as PlayerController;
    const world = new GameWorld(controller, () => .99, [], []);
    const state = world as unknown as { enemies: Enemy[]; bossEncounter: BossEncounter; elapsed: number;
        bossesKilled: number; processEnemyDeaths(): void; wavesStarted: number };
    const observed: Enemy[] = [];
    function advance(target: number) {
        while (state.elapsed < target && player.currentHp > 0 && world.remainingMs > 0) {
            world.update(Math.min(1000, target - state.elapsed));
            for (const enemy of state.enemies) if (isBossType(enemy.type) && !observed.includes(enemy)) observed.push(enemy);
            // Isolate boss scheduling/combat from unrelated ordinary crowd survival pressure.
            state.enemies = state.enemies.filter(enemy => isBossType(enemy.type));
        }
    }
    return { world, state, player, advance, observed, get kills() { return kills; }, get updates() { return updates; } };
}

test('world keeps dying boss occupied at a minute boundary and does not skip its successor', () => runWorld(f => {
    f.advance(119900);
    assert.deepEqual(f.observed.map(e => e.type), [EnemyType.BOSS]);
    const first = f.observed[0]; first.receiveDamage(100000, undefined, 0);
    assert.equal(first.isDead, true);
    f.advance(120000);
    assert.equal(f.state.bossEncounter.occupied, true, 'dead object is retained during swelling');
    assert.equal(f.state.enemies.length, 0, 'dead object is removed from collisions');
    assert.equal(f.kills, 1); assert.equal(f.state.bossesKilled, 1);
    f.advance(123000); assert.equal(f.state.bossEncounter.occupied, false);
    f.state.processEnemyDeaths(); assert.equal(f.kills, 1, 'death animation cannot award a second kill');
    f.advance(179000); assert.equal(f.observed.length, 1, 'no late mid-minute replacement');
    f.advance(180000);
    assert.deepEqual(f.observed.map(e => e.type), [EnemyType.BOSS, EnemyType.STEROID]);
}));

test('six-minute world releases the four distinct bosses in order without a fifth or end-of-run spawn', () => runWorld(f => {
    const order = [EnemyType.BOSS, EnemyType.STEROID, EnemyType.TENTACLE, EnemyType.WORM];
    for (let index = 0; index < order.length; index++) {
        f.advance((index + 1) * 60000);
        assert.equal(f.observed[index]?.type, order[index]);
        f.advance((index + 1) * 60000 + 2100);
        const boss = f.observed[index]; assert.equal(boss.invulnerable, false);
        boss.receiveDamage(100000, undefined, 0);
        f.advance((index + 1) * 60000 + 4000);
        assert.equal(f.state.bossEncounter.occupied, false);
    }
    f.advance(360000);
    assert.deepEqual(f.observed.map(e => e.type), order);
    assert.equal(f.state.bossesKilled, 4); assert.equal(f.kills, 4);
    assert.equal(f.world.isVictory, true); assert.equal(f.world.remainingMs, 0);
    assert.equal(f.state.wavesStarted, 71, 'no wave at exactly 0:00');
    const updates = f.updates; f.world.update(60000); assert.equal(f.updates, updates);
}));

test('player death freezes boss entrance, wave scheduling and combat updates', () => runWorld(f => {
    f.advance(60000); const age = f.state.bossEncounter.hudState?.ageMs;
    f.player.currentHp = 0; const updates = f.updates;
    f.world.update(60000);
    assert.equal(f.state.elapsed, 60000); assert.equal(f.state.bossEncounter.hudState?.ageMs, age);
    assert.equal(f.updates, updates); assert.equal(f.world.isVictory, false);
}));

test('hidden worm does not accumulate fear or damage-over-time effects for its return', () => {
    const enemy = new Enemy(100, 100, EnemyType.WORM);
    enemy.targetable = false; enemy.invulnerable = true;
    enemy.applyFear(3000, 0, 0);
    enemy.applyEffect({ burnMs: 3000, burnDps: 40 });
    assert.equal(enemy.isFeared, false);
    enemy.targetable = true; enemy.invulnerable = false;
    const health = enemy.currentHealth; enemy.update(1000);
    assert.equal(enemy.currentHealth, health);
});
