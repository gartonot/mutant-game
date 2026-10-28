import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { PlayerWeaponController, MAX_SHOTS_PER_STEP } from '../src/systems/Player/PlayerWeaponController';
import { Enemy } from '../src/entities/enemy/Enemy';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import type { PlayerController } from '../src/systems/Player/PlayerController';

function rig(id: Parameters<typeof createWeapon>[0], speed = 1, ammo = 20000) {
    let now = 0;
    const weapon = createWeapon(id, 1, speed, undefined, 1, 1, ammo);
    const controller = new PlayerWeaponController([weapon], () => now);
    return { weapon, controller, fire(time: number, held = true) {
        now = time;
        const shots = controller.tryShoot(0, 0, 0, undefined, held);
        controller.setBullets([]);
        return shots;
    } };
}

test('60 Hz firing preserves small speed gains over a minute', () => {
    const totals = [2, 2.04].map(speed => {
        const r = rig('pistol', speed);
        let count = 0;
        for (let step = 0; step < 3600; step++) count += r.fire(step * 1000 / 60)?.length ?? 0;
        return count;
    });
    assert.deepEqual(totals, [200, 204]);
});

test('golden boosted machine gun drains multiple shots per step after spin-up', () => {
    const speed = 4 * 1.3 * 1.4 * 1.2;
    const r = rig('machine-gun', speed);
    let shots = 0, max = 0;
    for (let step = 0; step < 3600; step++) {
        const count = r.fire(step * 1000 / 60)?.length ?? 0;
        shots += count; max = Math.max(max, count);
    }
    const first = Math.ceil((450 / speed) / (1000 / 60)) * (1000 / 60);
    const expected = Math.floor(((3599 * 1000 / 60) - first) / (60 / speed)) + 1;
    assert.equal(shots, expected);
    assert.ok(max > 1 && max < MAX_SHOTS_PER_STEP);
});

test('release, pause reset and empty ammunition never bank overdue shots', () => {
    const r = rig('rifle', 1, 2);
    assert.equal(r.fire(0)?.length, 1);
    r.fire(100, false);
    assert.equal(r.fire(10000)?.length, 1);
    r.fire(20000);
    r.weapon.state.addAmmo(10);
    assert.equal(r.fire(30000)?.length, 1);
    r.controller.resetTrigger();
    assert.equal(r.fire(40000)?.length, 1);
});

test('catch-up work is bounded and excess debt is dropped', () => {
    const r = rig('pistol', 600);
    assert.equal(r.fire(0)?.length, 1);
    assert.equal(r.fire(10000)?.length, MAX_SHOTS_PER_STEP);
    assert.equal(r.fire(10000), null);
    assert.equal(r.fire(10001)?.length, 1);
});

test('multiple laser pulses in one tick remain alive for collision detection', () => {
    const r = rig('laser', 10);
    assert.equal(r.fire(0)?.length, 1);
    const pulses = r.fire(1000 / 60)!;
    assert.equal(pulses.length, 2);
    assert.ok(pulses.every(p => !p.isDead));
    assert.equal(r.weapon.state.ammoRemaining, 20000 - 3);
    const target = new Enemy(200, 0);
    let hits = 0;
    target.receiveDamage = () => { hits++; };
    const fixture = { getBullets: () => pulses, registerHit() {} } as unknown as PlayerController;
    const collision = new CollisionSystem();
    collision.checkBulletEnemyCollisions(fixture, [target]);
    collision.checkBulletEnemyCollisions(fixture, [target]);
    assert.equal(hits, 2, 'each paid pulse damages once');
});

test('cadence changes retain fractional cooldown and release cannot bypass it', () => {
    const r = rig('pistol');
    r.fire(0);
    r.fire(300);
    r.controller.setPickupModifiers(1, 2);
    assert.equal(r.fire(449), null);
    assert.equal(r.fire(450)?.length, 1);
    r.fire(451, false);
    assert.equal(r.fire(452), null);
    assert.equal(r.fire(750)?.length, 1);
});

test('controller preserves charged shots and released burst completion', () => {
    const plasma = rig('plasma-cannon');
    assert.equal(plasma.fire(0), null);
    assert.equal(plasma.fire(449), null);
    assert.equal(plasma.fire(450)?.length, 1);
    assert.equal(plasma.fire(450), null);
    const burst = rig('double-barrel', 10);
    assert.equal(burst.fire(0)?.length, 4);
    assert.equal(burst.fire(17, false)?.length, 4);
    assert.equal(burst.fire(1000, false), null);
    assert.equal(burst.fire(1001)?.length, 4);
});

test('switching back to a cooled weapon gives one immediate shot, not an idle backlog', () => {
    let now = 0;
    const c = new PlayerWeaponController([createWeapon('pistol'), createWeapon('rifle')], () => now);
    c.tryShoot(0, 0, 0);
    c.switchToWeapon(1);
    now = 10000;
    c.switchToWeapon(0);
    assert.equal(c.tryShoot(0, 0, 0)?.length, 1);
});
