import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameWorld } from '../src/systems/GameWorld';
import { Player } from '../src/entities/player/Player';
import { Enemy } from '../src/entities/enemy/Enemy';
import { PlayerWeaponController } from '../src/systems/Player/PlayerWeaponController';
import type { PlayerController } from '../src/systems/Player/PlayerController';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import type { PickupDrop } from '../src/gameplay/PickupVariants';
import type { Pickup } from '../src/gameplay/Pickups';

test('enemy death → landed weapon → category ammo → exhausted weapon refill works for an entire run', () => {
    const previousWindow = globalThis.window;
    globalThis.window = { innerWidth: 1000, innerHeight: 800 } as Window & typeof globalThis;
    try {
        const player = new Player(); player.x = 100; player.y = 100;
        const inventory = new PlayerWeaponController([createWeapon('pistol'), null, null, null, null], () => 0);
        let kills = 0;
        const collected: PickupDrop[] = [];
        const rolls: number[] = [];
        const controller = {
            getPlayer: () => player, update: () => {}, getBullets: () => [], cleanupBullets: () => {},
            registerKill: () => kills++, collectPickup: () => {}, isMoving: false,
            get acquiredAmmoCategories() { return inventory.acquiredAmmoCategories; },
            collectDrop(drop: PickupDrop) {
                collected.push(drop);
                if (drop.kind === 'weapon') inventory.acquireWeapon(createWeapon(drop.weaponId));
                if (drop.kind === 'ammo') inventory.replenishAmmo(drop.ammoCategory);
            },
        } as unknown as PlayerController;
        const world = new GameWorld(controller, () => rolls.shift() ?? .99);
        const state = world as unknown as {
            enemies: Enemy[]; pickups: Pickup[]; stampBlood: () => void; processEnemyDeaths: () => void;
        };
        state.stampBlood = () => {};
        const defeat = (...values: number[]) => {
            rolls.push(...values);
            const enemy = new Enemy(500, 400); enemy.receiveDamage(100);
            state.enemies.push(enemy); state.processEnemyDeaths();
        };
        const collect = () => {
            const item = state.pickups[0];
            item.update(400); player.x = item.x; player.y = item.y;
            world.update(0);
            assert.equal(state.pickups.length, 0);
        };

        // An ammo-position roll with only the pistol produces a normal bonus instead.
        defeat(0, 0, .99);
        assert.equal(state.pickups[0].kind, 'health');
        state.pickups.length = 0;
        // Weapon chance, category and weapon selection all land on the shotgun.
        defeat(.99, 0, 0, 0);
        assert.equal(state.pickups[0].kind, 'weapon');
        assert.equal(state.pickups[0].weaponId, 'shotgun');
        assert.deepEqual(inventory.acquiredAmmoCategories, [], 'a weapon on the ground does not unlock ammo');
        collect();
        assert.equal(inventory.slots[1]?.id, 'shotgun');
        assert.deepEqual(inventory.acquiredAmmoCategories, ['shotgun']);

        const shotgun = inventory.slots[1]!;
        for (let i = 0; shotgun.state.hasAmmo; i++) shotgun.state.consumeShot(i * 10000);
        assert.equal(shotgun.state.ammoRemaining, 0);
        // Even at zero ammo the occupied shotgun slot cannot receive another weapon drop.
        defeat(.99, 0, 0, 0);
        assert.equal(state.pickups[0].kind, 'weapon');
        assert.equal(state.pickups[0].weaponId, 'rifle');
        state.pickups.length = 0;
        defeat(0, 0, 0, .99);
        assert.equal(state.pickups[0].ammoCategory, 'shotgun');
        collect();
        assert.equal(shotgun.state.ammoRemaining, Math.ceil(shotgun.state.ammoCapacity * .25));
        assert.deepEqual(collected.map(drop => drop.kind), ['weapon', 'ammo']);
        assert.equal(kills, 4);
        state.processEnemyDeaths();
        assert.equal(kills, 4, 'dead enemies cannot roll a second drop');

        inventory.acquireWeapon(createWeapon('rifle'));
        inventory.acquireWeapon(createWeapon('grenade-launcher'));
        inventory.acquireWeapon(createWeapon('tesla'));
        assert.equal(inventory.acquiredAmmoCategories.length, 4);
        defeat(.99, 0);
        assert.equal(state.pickups.length, 0, 'full equipment suppresses even a successful weapon roll');
        defeat(0, 0, 0, 0);
        assert.equal(state.pickups.length, 1);
        assert.equal(state.pickups[0].kind, 'ammo', 'full equipment still receives category ammunition');
    } finally { globalThis.window = previousWindow; }
});
