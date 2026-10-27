import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType } from '../src/entities/enemy/EnemyType';
import { applyPickupBlast, getPickupBlast } from '../src/gameplay/PickupBlasts';
import { PickupWaveEffect } from '../src/effects/PickupWaveEffect';
import { PickupExplosionEffect } from '../src/effects/PickupExplosionEffect';
import { GameWorld } from '../src/systems/GameWorld';
import { Player } from '../src/entities/player/Player';
import type { PlayerController } from '../src/systems/Player/PlayerController';
import { Pickup } from '../src/gameplay/Pickups';

test('blast damage uses the pickup center, includes radius boundary, excludes outside', () => {
    const center = new Enemy(500, 400), edge = new Enemy(815, 400), outside = new Enemy(815.01, 400);
    const opposite = new Enemy(184.99, 400);
    applyPickupBlast('fireBlast', 'silver', 500, 400, [center, edge, outside, opposite]);
    assert.equal(center.isDead, true); assert.equal(edge.isDead, true);
    assert.equal(outside.isDead, false); assert.equal(opposite.isDead, false);
    assert.equal(edge.x, 815, 'pickup waves do not move enemies away from the collection center');
});

test('ice blast damages once and slows living enemies within its smaller radius', () => {
    const enemy = new Enemy(210, 0), outside = new Enemy(210.01, 0);
    applyPickupBlast('iceBlast', 'silver', 0, 0, [enemy, outside]);
    assert.equal(enemy.isDead, false);
    enemy.setTarget(1000, 0); outside.setTarget(1000, 0);
    enemy.update(4000); outside.update(4000);
    assert.equal(enemy.x, 210.5); assert.equal(outside.x, 211.01);
    enemy.update(1); assert.equal(enemy.x, 211.5, 'slow expires on active simulation time');
    enemy.receiveDamage(1); assert.equal(enemy.isDead, true, 'ice initially removed exactly 1 HP');
});

test('gold blast tiers increase power but retain the requested fixed radii', () => {
    assert.deepEqual(getPickupBlast('iceBlast', 'gold'), { radius: 210, damage: 2, slowFactor: .25, slowMs: 8000 });
    assert.deepEqual(getPickupBlast('fireBlast', 'gold'), { radius: 315, damage: 12, slowFactor: 1, slowMs: 0 });
    const iceBoss = new Enemy(0, 0, EnemyType.BOSS);
    applyPickupBlast('iceBlast', 'gold', 0, 0, [iceBoss]);
    iceBoss.setTarget(1000, 0); iceBoss.update(7999); assert.equal(iceBoss.x, .25);
    iceBoss.update(1); assert.equal(iceBoss.x, .5);
    iceBoss.update(1); assert.equal(iceBoss.x, 1.5);
    iceBoss.receiveDamage(18); assert.equal(iceBoss.isDead, true);
    for (const [tier, remainder] of [['silver', 14], ['gold', 8]] as const) {
        const boss = new Enemy(0, 0, EnemyType.BOSS);
        applyPickupBlast('fireBlast', tier, 0, 0, [boss]);
        boss.receiveDamage(remainder - .1); assert.equal(boss.isDead, false);
        boss.receiveDamage(.2); assert.equal(boss.isDead, true);
    }
});

test('cluster explosion lasts 600 simulation milliseconds and cannot repeat gameplay damage', () => {
    const enemy = new Enemy(0, 0, EnemyType.BOSS);
    const blast = applyPickupBlast('fireBlast', 'silver', 0, 0, [enemy]);
    const wave = new PickupExplosionEffect(0, 0, blast.radius);
    wave.update(599); assert.equal(wave.isExpired, false);
    wave.update(0); assert.equal(wave.isExpired, false, 'paused simulation does not advance waves');
    wave.update(1); assert.equal(wave.isExpired, true);
    enemy.receiveDamage(13.9); assert.equal(enemy.isDead, false);
    enemy.receiveDamage(.2); assert.equal(enemy.isDead, true);
});

test('world collection credits blast kills once and preserves their new drops after compacting', () => {
    const previousWindow = globalThis.window;
    globalThis.window = { innerWidth: 1000, innerHeight: 800 } as Window & typeof globalThis;
    try {
        const player = new Player(); player.x = 200; player.y = 200;
        let kills = 0, collected = 0, scorchMarks = 0;
        const controller = {
            getPlayer: () => player, update: () => {}, getBullets: () => [], cleanupBullets: () => {},
            registerKill: () => kills++, collectPickup: () => collected++, isMoving: false,
            acquiredAmmoCategories: [],
        } as unknown as PlayerController;
        const world = new GameWorld(controller, () => 0, [], []);
        const internals = world as unknown as {
            enemies: Enemy[]; pickups: Pickup[]; pickupWaves: PickupWaveEffect[];
            pickupExplosions: PickupExplosionEffect[]; stampBlood: () => void; stampGround: () => void;
        };
        internals.stampBlood = () => {};
        internals.stampGround = () => { scorchMarks++; };
        internals.enemies.push(new Enemy(300, 200), new Enemy(400, 200));
        const pickup = new Pickup('fireBlast', 200, 200, 200, 200, 25, 1,
            { width: 1000, height: 800 });
        pickup.update(400); internals.pickups.push(pickup);
        world.update(16);
        assert.equal(kills, 2); assert.equal(collected, 1);
        assert.equal(internals.enemies.length, 0);
        assert.equal(internals.pickups.length, 2, 'each blast victim leaves its own drop');
        assert.ok(internals.pickups.every(drop => drop.kind !== 'ammo'), 'pistol-only blast kills cannot drop ammunition');
        assert.equal(internals.pickupWaves.length, 0);
        assert.equal(internals.pickupExplosions.length, 1);
        assert.equal(internals.pickupExplosions[0].x, 200);
        assert.equal(scorchMarks, 1, 'satellite explosions leave no ground marks');
        world.update(16);
        assert.equal(kills, 2); assert.equal(collected, 1);
        assert.equal(internals.pickups.length, 2);
        assert.equal(scorchMarks, 1, 'ground mark is stamped only on collection');
    } finally {
        globalThis.window = previousWindow;
    }
});

test('world death drops allow only ammunition categories acquired in this run', () => {
    const previousWindow = globalThis.window;
    globalThis.window = { innerWidth: 1000, innerHeight: 800 } as Window & typeof globalThis;
    try {
        const player = new Player();
        for (const hasAmmoWeapons of [false, true]) {
            const controller = { getPlayer: () => player, registerKill: () => {},
                acquiredAmmoCategories: hasAmmoWeapons ? ['shotgun'] : [] } as unknown as PlayerController;
            const world = new GameWorld(controller, () => 0, [], []);
            const internals = world as unknown as {
                enemies: Enemy[]; pickups: Pickup[]; stampBlood: () => void; processEnemyDeaths: () => void;
            };
            internals.stampBlood = () => {};
            const enemy = new Enemy(300, 200);
            enemy.receiveDamage(100);
            internals.enemies.push(enemy);
            internals.processEnemyDeaths();
            assert.equal(internals.pickups.length, 1);
            assert.equal(internals.pickups[0].kind, hasAmmoWeapons ? 'ammo' : 'health');
            assert.equal(internals.pickups[0].ammoCategory, hasAmmoWeapons ? 'shotgun' : undefined);
        }
    } finally {
        globalThis.window = previousWindow;
    }
});
