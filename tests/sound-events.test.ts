import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emitSound, subscribeSounds, weaponSound, type SoundId } from '../src/audio/SoundEvents';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { PlayerWeaponController } from '../src/systems/Player/PlayerWeaponController';
import { WEAPON_DEFINITIONS } from '../src/gameplay/weapons';
import { createGameWorld } from '../src/GameRuntime';
import { defaultLoadout } from '../src/gameplay/characters';
import { Grenade } from '../src/entities/bullet/Grenade';

test('sound listeners unsubscribe and unknown weapon timbres use the pistol placeholder', () => {
    const received: SoundId[] = [];
    const unsubscribe = subscribeSounds(sound => received.push(sound));
    emitSound('pistol'); unsubscribe(); unsubscribe(); emitSound('shotgun');
    assert.deepEqual(received, ['pistol']);
    const dedicated = new Set(['pistol', 'rifle', 'm16', 'ak47', 'machine-gun', 'shotgun', 'double-barrel', 'crossbow', 'grenade-launcher', 'tesla', 'impulse', 'disc-launcher', 'skull-launcher', 'laser', 'flamethrower', 'plasma-auto', 'plasma-cannon', 'acid-gun']);
    for (const weapon of Object.values(WEAPON_DEFINITIONS)) {
        if (!dedicated.has(weapon.id)) assert.equal(weaponSound(weapon.id), 'pistol', weapon.id);
    }
    assert.equal(weaponSound('tesla'), 'lightning');
    assert.equal(weaponSound('impulse'), 'impulse');
    assert.equal(weaponSound('disc-launcher'), 'disc');
    assert.equal(weaponSound('ak47'), 'ak47');
    assert.equal(weaponSound('m16'), 'm16');
    assert.equal(weaponSound('rifle'), 'automatic');
    assert.equal(weaponSound('crossbow'), 'crossbow');
    assert.equal(weaponSound('acid-gun'), 'acid');
    assert.equal(weaponSound('grenade-launcher'), 'bazooka');
});

test('shot sounds occur once per volley, ignore cooldown and empty ammo, and retain the last weapon timbre', () => {
    const received: SoundId[] = [];
    const unsubscribe = subscribeSounds(sound => received.push(sound));
    let now = 0;
    try {
        const shotgun = createWeapon('shotgun', 1, 1, undefined, 1, 0);
        shotgun.state.addAmmo(2);
        const controller = new PlayerWeaponController([createWeapon('pistol'), shotgun], () => now);
        controller.setDualWeaponsActive(true);
        controller.switchToWeapon(1);
        assert.equal(controller.tryShoot(100, 100, 0)!.length, 8);
        now = 1;
        assert.equal(controller.tryShoot(100, 100, 0), null);
        assert.deepEqual(received, ['shotgun']);
        now = 2000;
        controller.tryShoot(100, 100, 0);
        assert.equal(controller.selectedWeapon.id, 'pistol');
        assert.deepEqual(received, ['shotgun', 'shotgun']);
        const empty = new PlayerWeaponController([createWeapon('shotgun', 1, 1, undefined, 1, 0)]);
        assert.equal(empty.tryShoot(100, 100, 0), null);
        assert.deepEqual(received, ['shotgun', 'shotgun']);
    } finally { unsubscribe(); }
});

test('charged weapons remain silent during charging and double barrels sound on both actual shots', () => {
    const received: SoundId[] = [];
    const unsubscribe = subscribeSounds(sound => received.push(sound));
    let now = 0;
    try {
        const charged = new PlayerWeaponController([createWeapon('plasma-cannon')], () => now);
        assert.equal(charged.tryShoot(100, 100, 0), null);
        assert.deepEqual(received, []);
        now = 450;
        assert.ok(charged.tryShoot(100, 100, 0)?.length);
        const burst = new PlayerWeaponController([createWeapon('double-barrel')], () => now);
        burst.tryShoot(100, 100, 0);
        now += 110;
        burst.tryShoot(100, 100, 0, undefined, false);
        assert.deepEqual(received, ['gauss', 'shotgun', 'shotgun']);
    } finally { unsubscribe(); }
});

test('world explosions sound once at detonation and use distinct sounds for fire and ice charges', () => {
    const previous = ['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
    Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), { innerWidth: 1200, innerHeight: 800 }) });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: Object.assign(new EventTarget(), { hidden: false }) });
    const received: SoundId[] = [];
    const unsubscribe = subscribeSounds(sound => received.push(sound));
    const world = createGameWorld(undefined, 'mercenary', { ...defaultLoadout('mercenary'), consumables: [
        { slotIndex: 0, kind: 'fireBlast', tier: 'silver' },
        { slotIndex: 1, kind: 'iceBlast', tier: 'silver' },
    ] });
    try {
        const grenade = createWeapon('grenade-launcher').tryFire(0, 300, 300, 0)![0] as Grenade;
        world.getPlayerController().getBullets().push(grenade);
        world.update(0);
        assert.deepEqual(received, []);
        grenade.detonated = true;
        world.update(0); world.update(0);
        assert.deepEqual(received, ['explosion']);
        assert.equal(world.activateConsumable(0), true);
        assert.equal(world.activateConsumable(0), false);
        assert.deepEqual(received, ['explosion', 'explosion']);
        assert.equal(world.activateConsumable(1), true);
        assert.equal(world.activateConsumable(1), false);
        world.update(0);
        assert.deepEqual(received, ['explosion', 'explosion', 'ice-explosion']);
        const plasmaGrenade = createWeapon('plasma-grenade').tryFire(0, 300, 300, 0)![0] as Grenade;
        world.getPlayerController().getBullets().push(plasmaGrenade);
        world.update(0);
        assert.deepEqual(received, ['explosion', 'explosion', 'ice-explosion']);
        plasmaGrenade.detonated = true;
        world.update(0); world.update(0);
        assert.deepEqual(received, ['explosion', 'explosion', 'ice-explosion', 'plasma-explosion']);
    } finally {
        world.dispose(); world.getPlayerController().dispose(); unsubscribe();
        for (const [key, descriptor] of previous) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    }
});
