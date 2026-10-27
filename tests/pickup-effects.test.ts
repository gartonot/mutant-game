import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InputKey } from '../src/constants/InputKey';
import type { InputSystem } from '../src/systems/InputSystem';
import { PlayerMovementController } from '../src/systems/Player/PlayerMovementController';
import { Player } from '../src/entities/player/Player';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { WeaponState } from '../src/gameplay/WeaponState';
import { PlayerWeaponController } from '../src/systems/Player/PlayerWeaponController';
import { FixedStep, STEP_MS } from '../src/core/FixedStep';

test('gold bonuses double silver multipliers and expire back to baseline', () => {
    const player = new Player(); player.damageReduction = .2;
    for (const kind of ['shield', 'rapidFire', 'moveSpeed', 'doubleDamage'] as const) player.activateBonus(kind, 'gold');
    assert.equal(player.pickupAttackSpeed, 4);
    assert.equal(player.pickupDamageMultiplier, 4);
    assert.equal(player.pickupMoveSpeed, 3);
    player.takeDamage(20); assert.equal(player.currentHp, 96);
    player.updateBonuses(5000); assert.equal(player.bonusProgress.shield, .5);
    player.updateBonuses(5000);
    assert.deepEqual(player.bonusTiers, {});
    assert.equal(player.pickupAttackSpeed, 1);
    assert.equal(player.pickupDamageMultiplier, 1);
    assert.equal(player.pickupMoveSpeed, 1);
    player.takeDamage(20); assert.equal(player.currentHp, 80);
});

test('mixed tier pickups upgrade, refresh and reorder without downgrading active gold', () => {
    const player = new Player();
    player.activateBonus('moveSpeed'); player.activateBonus('shield');
    player.updateBonuses(2000);
    player.activateBonus('moveSpeed', 'gold');
    assert.equal(player.pickupMoveSpeed, 3);
    assert.deepEqual(player.bonusOrder, ['shield', 'moveSpeed']);
    player.activateBonus('shield', 'gold');
    player.updateBonuses(1000); player.activateBonus('moveSpeed');
    assert.equal(player.pickupMoveSpeed, 3);
    assert.equal(player.bonusTiers.moveSpeed, 'gold');
    assert.equal(player.bonusProgress.moveSpeed, 1);
    assert.equal(player.activeBonuses.moveSpeed, 10000);
    assert.deepEqual(player.bonusOrder, ['shield', 'moveSpeed']);
    const tiers = player.bonusTiers as { moveSpeed?: string }; tiers.moveSpeed = 'silver';
    assert.equal(player.bonusTiers.moveSpeed, 'gold');
    player.updateBonuses(10000); player.activateBonus('moveSpeed');
    assert.equal(player.pickupMoveSpeed, 1.5);
    assert.equal(player.bonusTiers.moveSpeed, 'silver');
});

test('gold medkit restores 100 HP over 400 ms and respects maximum health', () => {
    const player = new Player(); player.maxHp = 200; player.currentHp = 30;
    player.startPickupHealing(100);
    player.updatePickupHealing(200); assert.equal(player.currentHp, 80);
    player.updatePickupHealing(200); assert.equal(player.currentHp, 130);
    assert.deepEqual(player.bonusOrder, []);
    player.startPickupHealing(100);
    player.updatePickupHealing(400); assert.equal(player.currentHp, 200);
});

test('medkit heals 50 HP smoothly over 400 ms without becoming a timed HUD bonus', () => {
    const player = new Player(); player.takeDamage(80);
    player.startPickupHealing(50);
    assert.equal(player.currentHp, 20);
    player.updatePickupHealing(200); assert.equal(player.currentHp, 45);
    player.updatePickupHealing(200); assert.equal(player.currentHp, 70);
    player.updatePickupHealing(1000); assert.equal(player.currentHp, 70);
    assert.deepEqual(player.bonusOrder, []);
    assert.deepEqual(player.activeBonuses, { rapidFire: 0, moveSpeed: 0, doubleDamage: 0, shield: 0 });
});

test('medkits cap at maximum, overlap independently, and discard unused healing at full health', () => {
    const player = new Player(); player.maxHp = 200; player.currentHp = 20;
    player.startPickupHealing(50); player.updatePickupHealing(200);
    player.startPickupHealing(50); player.updatePickupHealing(200);
    assert.equal(player.currentHp, 95);
    player.updatePickupHealing(200); assert.equal(player.currentHp, 120);
    player.currentHp = 180; player.startPickupHealing(50);
    player.updatePickupHealing(200); assert.equal(player.currentHp, 190);
    player.updatePickupHealing(200); assert.equal(player.currentHp, 200);
    player.startPickupHealing(50); player.takeDamage(20);
    player.updatePickupHealing(400); assert.equal(player.currentHp, 180);
});

test('medkit healing preserves subsequent damage and never resurrects the player', () => {
    const player = new Player(); player.currentHp = 40;
    player.startPickupHealing(50); player.updatePickupHealing(200);
    player.takeDamage(20); player.updatePickupHealing(200);
    assert.equal(player.currentHp, 70);
    player.startPickupHealing(50); player.takeDamage(100);
    player.updatePickupHealing(400); player.startPickupHealing(50);
    assert.equal(player.currentHp, 0);
    player.currentHp = 10; player.updatePickupHealing(400);
    assert.equal(player.currentHp, 10);
});

test('medkit uses fixed simulation time and discards paused wall-clock time', () => {
    const player = new Player(); player.currentHp = 20; player.startPickupHealing(50);
    const clock = new FixedStep(), update = (dt: number) => player.updatePickupHealing(dt);
    for (let tick = 0; tick <= 12; tick++) clock.advance(tick * STEP_MS, update);
    assert.ok(Math.abs(player.currentHp - 45) < 1e-7);
    clock.reset(); clock.advance(100000, update);
    assert.ok(Math.abs(player.currentHp - 45) < 1e-7);
    for (let tick = 1; tick <= 12; tick++) clock.advance(100000 + tick * STEP_MS, update);
    assert.ok(Math.abs(player.currentHp - 70) < 1e-7);
});

test('pickup timers refresh and retain activation duration for clock progress', () => {
    const player = new Player(); player.bonusDuration = 1.25;
    for (const kind of ['shield', 'rapidFire', 'moveSpeed', 'doubleDamage'] as const) player.activateBonus(kind);
    assert.equal(player.pickupAttackSpeed, 2); assert.equal(player.pickupDamageMultiplier, 2);
    assert.equal(player.pickupMoveSpeed, 1.5); assert.equal(player.bonusProgress.shield, 1);
    player.updateBonuses(2500);
    assert.equal(player.bonusProgress.shield, .8);
    player.bonusDuration = 2;
    assert.equal(player.bonusProgress.shield, .8);
    player.activateBonus('shield');
    assert.equal(player.activeBonuses.shield, 20000); assert.equal(player.bonusProgress.shield, 1);
    player.updateBonuses(10000);
    assert.equal(player.pickupAttackSpeed, 1); assert.equal(player.pickupDamageMultiplier, 1);
    assert.equal(player.pickupMoveSpeed, 1); assert.equal(player.bonusProgress.moveSpeed, 0);
    assert.equal(player.bonusProgress.shield, .5);
    player.updateBonuses(10000); assert.equal(player.bonusProgress.shield, 0);
    player.takeDamage(100); player.heal(50); player.activateBonus('shield');
    assert.equal(player.currentHp, 0); assert.equal(player.activeBonuses.shield, 0);
});

test('active bonus order follows latest pickup, moves refresh to the end and removes expired entries', () => {
    const player = new Player();
    assert.deepEqual(player.bonusOrder, []);
    player.activateBonus('shield'); player.activateBonus('rapidFire');
    assert.deepEqual(player.bonusOrder, ['shield', 'rapidFire']);
    player.updateBonuses(2500); player.activateBonus('shield');
    assert.deepEqual(player.bonusOrder, ['rapidFire', 'shield']);
    assert.equal(player.activeBonuses.shield, 10000);
    assert.equal(player.bonusProgress.shield, 1);
    const copiedOrder = player.bonusOrder as string[]; copiedOrder.length = 0;
    assert.deepEqual(player.bonusOrder, ['rapidFire', 'shield']);
    player.updateBonuses(7500);
    assert.deepEqual(player.bonusOrder, ['shield']);
    assert.equal(player.activeBonuses.shield, 2500);
    player.updateBonuses(2500); assert.deepEqual(player.bonusOrder, []);
    player.takeDamage(100); player.activateBonus('moveSpeed');
    assert.deepEqual(player.bonusOrder, []);
});

test('shield halves incoming damage after armor and restores normal damage on expiry', () => {
    const player = new Player(); player.damageReduction = .2;
    player.activateBonus('shield'); player.takeDamage(20);
    assert.equal(player.currentHp, 92); assert.equal(player.damageTaken, 8);
    player.updateBonuses(10000); player.takeDamage(20);
    assert.equal(player.currentHp, 76); assert.equal(player.damageTaken, 24);
    player.heal(50); assert.equal(player.currentHp, 100);
    player.damageReduction = 0; player.activateBonus('shield'); player.takeDamage(20);
    assert.equal(player.currentHp, 90); assert.equal(player.damageTaken, 34);
});

test('run speed increases current movement by 50 percent and restores it on expiry within viewport bounds', () => {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { innerWidth: 800, innerHeight: 600 } });
    try {
        const player = new Player(100, 100); player.speed = 7;
        const input = { isPressed: (key: string) => key === InputKey.D } as InputSystem;
        const movement = new PlayerMovementController(player, input);
        movement.update(); assert.equal(player.x, 107);
        player.activateBonus('moveSpeed'); movement.update(); assert.equal(player.x, 117.5);
        assert.equal(player.speed, 7);
        player.x = 775; movement.update(); assert.equal(player.x, 780);
        player.x = 100; player.updateBonuses(10000); movement.update(); assert.equal(player.x, 107);
    } finally {
        if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
        else Reflect.deleteProperty(globalThis, 'window');
    }
});

test('typed ammo replenishes only its category and caps without affecting pistol', () => {
    const pistol = createWeapon('pistol'), rifle = createWeapon('rifle'), shotgun = createWeapon('shotgun');
    const controller = new PlayerWeaponController([pistol, rifle, null, shotgun], () => 0);
    controller.replenishAmmo('automatic');
    assert.equal(pistol.state.ammoRemaining, Infinity);
    assert.equal(rifle.state.ammoRemaining, 180); assert.equal(shotgun.state.ammoRemaining, 30);
    controller.replenishAmmo('automatic'); controller.replenishAmmo('automatic');
    controller.replenishAmmo('shotgun'); controller.replenishAmmo('shotgun'); controller.replenishAmmo('shotgun');
    assert.equal(rifle.state.ammoRemaining, 240); assert.equal(shotgun.state.ammoRemaining, 60);
});

test('rapid fire preserves cooldown progress on activation and expiry without resetting ammunition', () => {
    const state = new WeaponState({ kind: 'finite', initial: 5, capacity: 10, perShot: 1 }, 600);
    assert.equal(state.consumeShot(0), true);
    state.setCadenceMultiplier(2, 300);
    assert.equal(state.cooldownProgress(300), .5); assert.equal(state.shotIntervalMs, 300);
    assert.equal(state.canShoot(449), false); assert.equal(state.consumeShot(450), true);
    state.setCadenceMultiplier(1, 600);
    assert.equal(state.cooldownProgress(600), .5); assert.equal(state.canShoot(899), false);
    assert.equal(state.consumeShot(900), true); assert.equal(state.ammoRemaining, 2);
});

test('damage pickup multiplies upgraded direct, explosive and damage-over-time attacks and restores baseline', () => {
    for (const id of ['rifle', 'grenade-launcher', 'flamethrower', 'acid-gun'] as const) {
        const weapon = createWeapon(id, 1.3, 1.2);
        const baseline = weapon.tryFire(0, 100, 100, 0)![0];
        weapon.setPickupModifiers(2, 2, 2000);
        const boosted = weapon.tryFire(2000, 100, 100, 0)![0];
        assert.equal(boosted.damage, baseline.damage * 2);
        if (baseline.effect?.burnDps) assert.equal(boosted.effect?.burnDps, baseline.effect.burnDps * 2);
        if (baseline.effect?.acidDps) assert.equal(boosted.effect?.acidDps, baseline.effect.acidDps * 2);
        weapon.setPickupModifiers(1, 1, 4000);
        assert.equal(weapon.tryFire(4000, 100, 100, 0)![0].damage, baseline.damage);
    }
});

test('rapid fire modifies charge duration and both shots of a burst', () => {
    const plasma = createWeapon('plasma-cannon'); plasma.setPickupModifiers(1, 2, 0);
    assert.equal(plasma.tryFire(0, 100, 100, 0), null);
    assert.equal(plasma.tryFire(224, 100, 100, 0), null);
    assert.ok(plasma.tryFire(225, 100, 100, 0));
    const burst = createWeapon('double-barrel'); burst.setPickupModifiers(1, 2, 0);
    assert.ok(burst.tryFire(0, 100, 100, 0));
    assert.equal(burst.tryFire(54, 100, 100, 0), null);
    assert.ok(burst.tryFire(55, 100, 100, 0));
    assert.equal(burst.tryFire(654, 100, 100, 0), null);
    assert.ok(burst.tryFire(655, 100, 100, 0));
});
