import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { WEAPON_DEFINITIONS } from '../src/gameplay/weapons';
import { PlayerWeaponController } from '../src/systems/Player/PlayerWeaponController';
import { Beam } from '../src/entities/bullet/Beam';
import { Disc } from '../src/entities/bullet/SpecialProjectiles';
import { dualCharacterPose, muzzlePosition } from '../src/rendering/WeaponGeometry';

test('fused clone stays behind the player and faces away at every rotation and preview scale', () => {
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 3]) {
        for (const scale of [1, 2.5]) {
            const pose = dualCharacterPose(200, 300, angle, scale);
            const dx = pose.x - 200, dy = pose.y - 300;
            assert.ok(Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle) + 12 * scale) < 1e-8);
            assert.ok(Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle)) < 1e-8);
            assert.ok(Math.abs(Math.cos(pose.angle - angle) + 1) < 1e-8);
        }
    }
});

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
            assert.ok(Math.abs(paired[i].dx + paired[i + baseline.length].dx) < 1e-8, definition.id + ' opposite X direction');
            assert.ok(Math.abs(paired[i].dy + paired[i + baseline.length].dy) < 1e-8, definition.id + ' opposite Y direction');
        }
    }
});

test('rear projectiles and muzzle flashes originate at the rotated clone weapon', () => {
    for (const angle of [0, Math.PI / 2, -Math.PI / 3]) {
        const weapon = createWeapon('rifle', 1, 1, 'mercenary');
        weapon.setDualWeaponsActive(true);
        const flashes: { x: number; y: number; angle: number }[] = [];
        const [primary, rear] = weapon.tryFire(0, 300, 300, angle,
            (x, y, flashAngle) => flashes.push({ x, y, angle: flashAngle }))!;
        const expected = muzzlePosition('rifle', 300 - Math.cos(angle) * 12, 300 - Math.sin(angle) * 12,
            angle + Math.PI, 'mercenary');
        assert.ok(Math.abs(rear.x - expected.x) < 1e-8);
        assert.ok(Math.abs(rear.y - expected.y) < 1e-8);
        assert.equal(flashes.length, 2);
        for (const [i, projectile] of [primary, rear].entries()) {
            assert.equal(flashes[i].x, projectile.x);
            assert.equal(flashes[i].y, projectile.y);
            assert.ok(Math.abs(Math.cos(flashes[i].angle) - projectile.dx) < 1e-8);
            assert.ok(Math.abs(Math.sin(flashes[i].angle) - projectile.dy) < 1e-8);
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
    const expected = muzzlePosition('laser', 300, 288, Math.PI * 1.5, 'mercenary');
    assert.ok(Math.abs(copy.previousX - expected.x) < 1e-8);
    assert.ok(Math.abs(copy.previousY - expected.y) < 1e-8);
    assert.ok(Math.abs(copy.dx + primary.dx) < 1e-8);
    assert.ok(Math.abs(copy.dy + primary.dy) < 1e-8);
    assert.ok(copy.y < copy.previousY, 'rear laser points upward when player aims downward');
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
