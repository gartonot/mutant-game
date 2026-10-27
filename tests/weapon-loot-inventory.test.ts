import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { PlayerWeaponController } from '../src/systems/Player/PlayerWeaponController';
import { createCharacter } from '../src/gameplay/CharacterFactory';
import { defaultLoadout } from '../src/gameplay/characters';
import { EMPTY_IMPLANTS } from '../src/gameplay/implants';
import { EMPTY_ARSENAL } from '../src/gameplay/arsenal';

test('loot acquisition locks the first weapon in each slot and preserves fired bullets and starting slots', () => {
    const initial = [createWeapon('pistol'), null, null, null, null];
    const inventory = new PlayerWeaponController(initial, () => 0);
    assert.deepEqual(inventory.acquiredAmmoCategories, []);
    inventory.acquireWeapon(createWeapon('shotgun'));
    assert.equal(inventory.selectedIndex, 0);
    assert.equal(inventory.selectedWeapon.id, 'pistol');
    inventory.switchToWeapon(1);
    assert.equal(inventory.selectedIndex, 1);
    const fired = inventory.tryShoot(0, 0, 0)!;
    const shotgun = inventory.selectedWeapon;
    const ammoBefore = shotgun.state.ammoRemaining;
    assert.equal(inventory.acquireWeapon(createWeapon('crossbow')), 'ammo');
    assert.equal(inventory.slots[1], shotgun);
    assert.equal(shotgun.state.ammoRemaining, ammoBefore + Math.ceil(shotgun.state.ammoCapacity * .25));
    assert.equal(inventory.selectedIndex, 1);
    assert.equal(inventory.selectedWeapon.id, 'shotgun');
    assert.deepEqual(inventory.getBullets(), fired);
    assert.ok(fired.every(bullet => !bullet.isDead));
    assert.equal(initial[1], null);
    assert.deepEqual(inventory.acquiredAmmoCategories, ['shotgun']);
    inventory.acquireWeapon(createWeapon('rifle'));
    assert.deepEqual(inventory.acquiredAmmoCategories, ['shotgun', 'automatic']);
    assert.equal(inventory.slots[2]!.id, 'rifle');
    assert.equal(inventory.selectedIndex, 1);
    inventory.switchToWeapon(2);
    assert.equal(inventory.selectedWeapon.id, 'rifle');
});

test('slot lock survives exhaustion, is copied, and resets with a new run', () => {
    const shotgun = createWeapon('shotgun');
    const inventory = new PlayerWeaponController([createWeapon('pistol'), shotgun], () => 0);
    for (let t = 0; shotgun.state.hasAmmo; t += 10000) shotgun.state.consumeShot(t);
    assert.deepEqual(inventory.acquiredAmmoCategories, ['shotgun']);
    inventory.replenishAmmo('automatic');
    assert.equal(shotgun.state.ammoRemaining, 0);
    inventory.replenishAmmo('shotgun');
    assert.equal(shotgun.state.ammoRemaining, Math.ceil(shotgun.state.ammoCapacity * .25));
    inventory.acquireWeapon(createWeapon('double-barrel'));
    assert.equal(inventory.slots[1], shotgun);
    const history = inventory.acquiredAmmoCategories as string[]; history.length = 0;
    assert.deepEqual(inventory.acquiredAmmoCategories, ['shotgun']);
    const fresh = new PlayerWeaponController([createWeapon('pistol')]);
    assert.deepEqual(fresh.acquiredAmmoCategories, []);
    assert.equal(fresh.acquireWeapon(createWeapon('crossbow')), 'weapon');
    assert.equal(fresh.slots[1]!.id, 'crossbow');
});

test('duplicate weapons refill the existing instance and picked weapons inherit current temporary modifiers', () => {
    const inventory = new PlayerWeaponController([createWeapon('pistol')], () => 0);
    inventory.setPickupModifiers(4, 4);
    const shotgun = createWeapon('shotgun');
    inventory.acquireWeapon(shotgun);
    inventory.switchToWeapon(1);
    assert.equal(shotgun.state.shotIntervalMs, createWeapon('shotgun').state.shotIntervalMs / 4);
    const baseDamage = createWeapon('shotgun').tryFire(0, 0, 0, 0)![0].damage;
    assert.equal(inventory.tryShoot(0, 0, 0)![0].damage, baseDamage * 4);
    const remaining = shotgun.state.ammoRemaining;
    inventory.acquireWeapon(createWeapon('shotgun'));
    assert.equal(inventory.selectedWeapon, shotgun);
    assert.ok(shotgun.state.ammoRemaining > remaining);
    inventory.acquireWeapon(createWeapon('shotgun'));
    inventory.acquireWeapon(createWeapon('shotgun'));
    assert.equal(shotgun.state.ammoRemaining, shotgun.state.ammoCapacity);
    assert.equal(shotgun.state.shotIntervalMs, createWeapon('shotgun').state.shotIntervalMs / 4);
    inventory.setPickupModifiers(1, 1);
    assert.equal(shotgun.state.shotIntervalMs, createWeapon('shotgun').state.shotIntervalMs);
});

test('an exhausted crossbow remains locked when a shotgun or another crossbow is collected', () => {
    const crossbow = createWeapon('crossbow');
    const inventory = new PlayerWeaponController([createWeapon('pistol')], () => 0);
    inventory.acquireWeapon(crossbow);
    for (let t = 0; crossbow.state.hasAmmo; t += 10000) crossbow.state.consumeShot(t);
    assert.equal(inventory.acquireWeapon(createWeapon('shotgun')), 'ammo');
    assert.equal(inventory.slots[1], crossbow);
    assert.equal(crossbow.state.ammoRemaining, Math.ceil(crossbow.state.ammoCapacity * .25));
    assert.equal(inventory.acquireWeapon(createWeapon('crossbow')), 'ammo');
    assert.equal(inventory.slots[1], crossbow);
});

for (const pickupId of ['rifle', 'plasma-cannon', 'tesla'] as const) {
    test(`picking up ${pickupId} preserves the selected plasma cannon and its charge`, () => {
        let now = 0;
        const plasma = createWeapon('plasma-cannon');
        const inventory = new PlayerWeaponController([createWeapon('pistol'), null, null, null, plasma], () => now);
        inventory.switchToWeapon(4);
        assert.equal(inventory.tryShoot(0, 0, 0), null);
        now = 200;
        assert.equal(inventory.tryShoot(0, 0, 0), null);
        const progress = plasma.chargeProgress;
        assert.ok(progress > 0);
        inventory.acquireWeapon(createWeapon(pickupId));
        assert.equal(inventory.selectedIndex, 4);
        assert.equal(inventory.selectedWeapon, plasma);
        assert.equal(plasma.chargeProgress, progress);
        now = 450;
        assert.ok(inventory.tryShoot(0, 0, 0)?.length);
    });
}

test('run weapon factory gives loot the same character, implant, arsenal and progression stats as starting equipment', () => {
    const run = createCharacter({
        ...defaultLoadout('assassin'),
        implants: { ...EMPTY_IMPLANTS, damage: 10, attackSpeed: 10 },
        arsenal: { ...EMPTY_ARSENAL, shotgun: 20 },
        weapons: [{ slotId: '1', weaponId: 'pistol' }, { slotId: '2', weaponId: 'shotgun' }],
    }, [{ stat: 'damage', operation: 'percent', value: .25 }]);
    const starting = run.weapons[1]!, loot = run.createRunWeapon('shotgun');
    assert.notEqual(starting, loot);
    assert.equal(loot.state.ammoRemaining, starting.state.ammoRemaining);
    assert.equal(loot.state.ammoCapacity, starting.state.ammoCapacity);
    assert.equal(loot.state.shotIntervalMs, starting.state.shotIntervalMs);
    assert.equal(loot.tryFire(0, 0, 0, 0)![0].damage, starting.tryFire(0, 0, 0, 0)![0].damage);
    assert.ok(loot.state.ammoRemaining > createWeapon('shotgun').state.ammoRemaining);
});
