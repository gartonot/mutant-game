import assert from 'node:assert/strict';
import { test } from 'node:test';
import { subscribePlasmaChargeSound, subscribeSounds, type PlasmaChargeSound } from '../src/audio/SoundEvents';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { PlayerWeaponController } from '../src/systems/Player/PlayerWeaponController';

test('plasma charge follows particles and ends before the actual shot, with silence during cooldown', () => {
    let now = 0;
    const events: (PlasmaChargeSound | string)[] = [];
    const unsubscribe = subscribePlasmaChargeSound(value => events.push(value));
    const unsubscribeShots = subscribeSounds(value => events.push(value));
    try {
        const weapon = createWeapon('plasma-cannon');
        const controller = new PlayerWeaponController([weapon], () => now);
        assert.equal(controller.tryShoot(0, 0, 0), null);
        assert.deepEqual(events.at(-1), { progress: 0, durationMs: 450 });
        now = 225;
        controller.tryShoot(0, 0, 0);
        assert.deepEqual(events.at(-1), { progress: weapon.chargeProgress, durationMs: 450 });
        assert.equal(weapon.chargeProgress, .5);
        now = 450;
        assert.ok(controller.tryShoot(0, 0, 0)?.length);
        assert.deepEqual(events.slice(-2), [null, 'gauss']);
        now = 700;
        controller.tryShoot(0, 0, 0);
        assert.equal(events.at(-1), null);
        now = 950;
        controller.tryShoot(0, 0, 0);
        assert.deepEqual(events.at(-1), { progress: 0, durationMs: 450 });
    } finally { unsubscribe(); unsubscribeShots(); }
});

test('plasma charge duration accounts for character speed and changing pickup speed', () => {
    let now = 0;
    const states: PlasmaChargeSound[] = [];
    const unsubscribe = subscribePlasmaChargeSound(value => states.push(value));
    try {
        const controller = new PlayerWeaponController([createWeapon('plasma-cannon', 1, 2)], () => now);
        controller.tryShoot(0, 0, 0);
        assert.deepEqual(states.at(-1), { progress: 0, durationMs: 225 });
        now = 112.5;
        controller.tryShoot(0, 0, 0);
        controller.setPickupModifiers(1, 2);
        controller.tryShoot(0, 0, 0);
        assert.deepEqual(states.at(-1), { progress: .5, durationMs: 112.5 });
        now = 168.75;
        assert.ok(controller.tryShoot(0, 0, 0)?.length);
        assert.equal(states.at(-1), null);
    } finally { unsubscribe(); }
});

test('plasma charge cancels on release, switch and reset, and never starts without ammo', () => {
    const states: PlasmaChargeSound[] = [];
    const unsubscribe = subscribePlasmaChargeSound(value => states.push(value));
    try {
        const controller = new PlayerWeaponController([createWeapon('plasma-cannon'), createWeapon('pistol')], () => 0);
        controller.tryShoot(0, 0, 0);
        controller.tryShoot(0, 0, 0, undefined, false);
        assert.equal(states.at(-1), null);
        controller.tryShoot(0, 0, 0);
        assert.ok(states.at(-1));
        controller.switchToWeapon(1);
        assert.equal(states.at(-1), null);
        controller.switchToWeapon(0);
        controller.tryShoot(0, 0, 0);
        controller.resetTrigger();
        assert.equal(states.at(-1), null);
        const empty = new PlayerWeaponController([createWeapon('plasma-cannon', 1, 1, undefined, 1, 0)], () => 0);
        empty.tryShoot(0, 0, 0);
        assert.equal(states.at(-1), null);
    } finally { unsubscribe(); }
});
