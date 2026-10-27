import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { Grenade } from '../src/entities/bullet/Grenade';
import { Enemy } from '../src/entities/enemy/Enemy';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import type { PlayerController } from '../src/systems/Player/PlayerController';
import { WEAPON_DEFINITIONS } from '../src/gameplay/weapons';

test('explosion stat enlarges damage reach and visual radius for every explosive weapon', () => {
    for (const definition of Object.values(WEAPON_DEFINITIONS).filter(d => ['grenade', 'skull', 'plasma-grenade'].includes(d.projectile))) {
        for (const multiplier of [1, 1.5]) {
            const grenade = createWeapon(definition.id, 1, 1, undefined, multiplier).tryFire(0, 100, 100, 0)![0] as Grenade;
            assert.ok(grenade instanceof Grenade);
            grenade.detonated = true;
            const enemy = new Enemy(grenade.x + 130, grenade.y);
            const outside = new Enemy(grenade.x + 220, grenade.y);
            let visualRadius = 0;
            const bullets = [grenade];
            const controller = { getBullets: () => bullets, registerHit() {}, registerProjectiles() {} } as unknown as PlayerController;
            new CollisionSystem().checkBulletEnemyCollisions(controller, [enemy, outside], (_x, _y, radius) => { visualRadius = radius; });
            assert.equal(enemy.isDead, multiplier > 1, definition.id);
            assert.equal(outside.isDead, false, definition.id);
            assert.equal(visualRadius, 95 * multiplier, definition.id);
        }
    }
});

test('weapon damage modifier scales burn and skull fragments without changing catalog effects', () => {
    const flame = createWeapon('flamethrower', 1.5).tryFire(0, 100, 100, 0)![0];
    assert.equal(flame.effect?.burnDps, WEAPON_DEFINITIONS.flamethrower.effect!.burnDps! * 1.5);
    assert.equal(createWeapon('flamethrower').tryFire(0, 100, 100, 0)![0].effect?.burnDps, WEAPON_DEFINITIONS.flamethrower.effect!.burnDps);
    const skull = createWeapon('skull-launcher', 1.5).tryFire(0, 100, 100, 0)![0] as Grenade;
    skull.detonated = true;
    const bullets = [skull];
    const controller = { getBullets: () => bullets, registerHit() {}, registerProjectiles() {} } as unknown as PlayerController;
    new CollisionSystem().checkBulletEnemyCollisions(controller, []);
    assert.equal(bullets.length, 9);
    assert.ok(bullets.slice(1).every(fragment => fragment.damage === WEAPON_DEFINITIONS['skull-launcher'].damage * 1.5 * .3));
});

test('invalid explosion multipliers are rejected at weapon construction', () => {
    for (const radius of [0, -1, NaN, Infinity]) assert.throws(() => createWeapon('pistol', 1, 1, undefined, radius), /Invalid weapon modifiers/);
});
