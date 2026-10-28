import assert from 'node:assert/strict';
import { test } from 'node:test';
import { subscribeFlameSound, subscribeSounds, type SoundId } from '../src/audio/SoundEvents';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { PlayerWeaponController } from '../src/systems/Player/PlayerWeaponController';

test('flamethrower sustains its sound across pulses and stops on release, switch and reset', () => {
    let now = 0;
    let active = false;
    const shots: SoundId[] = [];
    const unsubscribe = subscribeFlameSound(value => { active = value; });
    const unsubscribeShots = subscribeSounds(value => shots.push(value));
    try {
        const controller = new PlayerWeaponController([createWeapon('flamethrower'), createWeapon('pistol')], () => now);
        assert.ok(controller.tryShoot(0, 0, 0)?.length);
        assert.equal(active, true);
        now = 30;
        assert.equal(controller.tryShoot(0, 0, 0), null);
        assert.equal(active, true);
        now = 65;
        assert.ok(controller.tryShoot(0, 0, 0)?.length);
        assert.deepEqual(shots, [], 'continuous flamethrower must not emit stacked one-shot sounds');
        controller.tryShoot(0, 0, 0, undefined, false);
        assert.equal(active, false);
        now = 130;
        controller.tryShoot(0, 0, 0);
        assert.equal(active, true);
        controller.switchToWeapon(1);
        assert.equal(active, false);
        controller.switchToWeapon(0);
        now = 195;
        controller.tryShoot(0, 0, 0);
        assert.equal(active, true);
        controller.resetTrigger();
        assert.equal(active, false);
    } finally { unsubscribe(); unsubscribeShots(); }
});

test('empty flamethrower stays silent and its sustained sound stops when ammunition runs out', () => {
    let now = 0;
    let active = false;
    const unsubscribe = subscribeFlameSound(value => { active = value; });
    try {
        const flamethrower = createWeapon('flamethrower', 1, 1, undefined, 1, 0);
        const controller = new PlayerWeaponController([flamethrower], () => now);
        assert.equal(controller.tryShoot(0, 0, 0), null);
        assert.equal(active, false);
        flamethrower.state.addAmmo(2);
        controller.tryShoot(0, 0, 0);
        assert.equal(active, true);
        now = 65;
        assert.ok(controller.tryShoot(0, 0, 0)?.length);
        assert.equal(flamethrower.state.hasAmmo, false);
        assert.equal(active, false);
    } finally { unsubscribe(); }
});

