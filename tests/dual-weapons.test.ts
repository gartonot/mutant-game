import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { WEAPON_DEFINITIONS } from '../src/gameplay/weapons';
import { PlayerWeaponController } from '../src/systems/Player/PlayerWeaponController';
import { Beam } from '../src/entities/bullet/Beam';
import { Disc } from '../src/entities/bullet/SpecialProjectiles';
import { DUAL_WEAPON_OFFSET, muzzlePosition } from '../src/rendering/WeaponGeometry';

test('dual weapons double every projectile family with modifiers and only one ammo payment', () => {
    for (const definition of Object.values(WEAPON_DEFINITIONS)) {
        const normal = createWeapon(definition.id, 1.7, 1, 'mercenary', 1.5);
        const dual = createWeapon(definition.id, 1.7, 1, 'mercenary', 1.5);
        normal.setPickupModifiers(2, 1, 0); dual.setPickupModifiers(2, 1, 0);
        dual.setDualWeaponsActive(true);
        let baseline = normal.tryFire(0, 200, 200, 0), paired = dual.tryFire(0, 200, 200, 0);
        if (!baseline) {
            assert.equal(paired, null, definition.id + ' waits for charge/spin-up');
            baseline = normal.tryFire(2000, 200, 200, 0); paired = dual.tryFire(2000, 200, 200, 0);
        }
        assert.ok(baseline && paired, definition.id);
        assert.equal(paired.length, baseline.length * 2, definition.id);
        assert.equal(dual.state.ammoRemaining, normal.state.ammoRemaining, definition.id);
        for (let i = 0; i < baseline.length; i++) {
            assert.equal(paired[i + baseline.length].damage, baseline[i].damage);
            assert.equal(paired[i + baseline.length].constructor, baseline[i].constructor);
            assert.notEqual(paired[i], paired[i + baseline.length]);
        }
    }
});

test('dual copies stop when primary is empty and follow weapon switches and new pickups', () => {
    let now = 0;
    const pistol = createWeapon('pistol'), shotgun = createWeapon('shotgun', 1, 1, undefined, 1, 0);
    shotgun.state.addAmmo(1);
    const controller = new PlayerWeaponController([pistol, shotgun, createWeapon('rifle')], () => now);
    controller.setDualWeaponsActive(true); controller.switchToWeapon(1);
    assert.equal(controller.tryShoot(200, 200, 0)!.length, WEAPON_DEFINITIONS.shotgun.pellets.length * 2);
    now = 10000;
    assert.equal(controller.tryShoot(200, 200, 0), null);
    controller.switchToWeapon(0);
    assert.equal(controller.tryShoot(200, 200, 0)!.length, 2);
    controller.acquireWeapon(createWeapon('ak47')); controller.switchToWeapon(2);
    assert.equal(controller.tryShoot(200, 200, 0)!.length, 2);
    controller.setDualWeaponsActive(false); now += controller.selectedWeapon.state.shotIntervalMs;
    assert.equal(controller.tryShoot(200, 200, 0)!.length, 1);
});

test('dual laser tracks both muzzles and keeps independent hits, expiry kills only the copy', () => {
    const laser = createWeapon('laser', 1, 1, 'mercenary'); laser.setDualWeaponsActive(true);
    const [primary, copy] = laser.tryFire(0, 200, 200, 0)! as Beam[];
    primary.touched.add({}); assert.equal(copy.touched.size, 0);
    assert.equal(laser.tryFire(1, 300, 300, Math.PI / 2), null);
    const expected = muzzlePosition('laser', 300 - DUAL_WEAPON_OFFSET, 300, Math.PI / 2, 'mercenary');
    assert.ok(Math.abs(copy.previousX - expected.x) < 1e-8);
    assert.ok(Math.abs(copy.previousY - expected.y) < 1e-8);
    laser.setDualWeaponsActive(false);
    assert.equal(copy.isDead, true); assert.equal(primary.isDead, false);
    laser.resetTrigger(2); assert.equal(primary.isDead, true);
});

test('dual discs do not share targets and burst pairs pay only their normal shot costs', () => {
    const disc = createWeapon('disc-launcher'); disc.setDualWeaponsActive(true);
    const [a, b] = disc.tryFire(0, 200, 200, 0)! as Disc[];
    a.touched.add({}); assert.equal(b.touched.size, 0);
    const shotgun = createWeapon('double-barrel'), ammo = shotgun.state.ammoRemaining;
    shotgun.setDualWeaponsActive(true);
    assert.equal(shotgun.tryFire(0, 200, 200, 0)!.length, WEAPON_DEFINITIONS['double-barrel'].pellets.length * 2);
    assert.equal(shotgun.tryFire(WEAPON_DEFINITIONS['double-barrel'].burstGapMs!, 200, 200, 0, undefined, false)!.length,
        WEAPON_DEFINITIONS['double-barrel'].pellets.length * 2);
    assert.equal(shotgun.state.ammoRemaining, ammo - 2);
});
