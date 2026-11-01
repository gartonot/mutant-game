import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType } from '../src/entities/enemy/EnemyType';
import type { Bullet } from '../src/entities/bullet/Bullet';
import { Beam } from '../src/entities/bullet/Beam';
import { Grenade } from '../src/entities/bullet/Grenade';
import type { WeaponId } from '../src/gameplay/ids';
import { muzzlePosition, dualCharacterPose } from '../src/rendering/WeaponGeometry';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import type { PlayerController } from '../src/systems/Player/PlayerController';

function fixture(bullets: Bullet[]) {
    let hits = 0;
    return {
        controller: { getBullets: () => bullets, registerHit: () => hits++, registerProjectiles() {} } as unknown as PlayerController,
        get hits() { return hits; },
    };
}

function target(x: number, y: number) {
    // A small real enemy can reach inside even a pistol's muzzle offset.
    const enemy = new Enemy(x, y, EnemyType.LEECH), damage: number[] = [];
    enemy.receiveDamage = amount => { damage.push(amount); };
    return { enemy, damage };
}

function fire(id: WeaponId) {
    const weapon = createWeapon(id);
    const flashes: { x: number; y: number }[] = [];
    const flash = (x: number, y: number) => flashes.push({ x, y });
    const shots = weapon.tryFire(0, 300, 300, 0, flash)
        ?? weapon.tryFire(2000, 300, 300, 0, flash);
    assert.ok(shots?.length, id);
    return { shots, flashes };
}

test('real weapon projectiles hit a small enemy between the character and muzzle after their first update', () => {
    const weapons: WeaponId[] = ['pistol', 'rifle', 'shotgun', 'double-barrel', 'machine-gun', 'crossbow',
        'acid-gun', 'disc-launcher', 'flamethrower', 'tesla', 'laser', 'plasma-cannon', 'impulse',
        'grenade-launcher', 'skull-launcher', 'plasma-grenade'];
    for (const id of weapons) {
        const { shots, flashes } = fire(id), near = target(325, 300);
        const muzzle = muzzlePosition(id, 300, 300, 0);
        if (!(shots[0] instanceof Beam) && id !== 'tesla') {
            assert.equal(shots[0].x, muzzle.x, `${id}: projectile artwork still starts at the muzzle`);
            assert.equal(shots[0].y, muzzle.y);
        }
        for (const point of flashes) assert.deepEqual(point, muzzle, `${id}: muzzle flashes retain their location`);
        for (const shot of shots) shot.update(1000 / 60);
        const f = fixture(shots);
        new CollisionSystem().checkBulletEnemyCollisions(f.controller, [near.enemy]);
        assert.ok(near.damage.length > 0, `${id}: a contact-range target must receive a hit`);
        assert.ok(f.hits > 0, `${id}: contact hits count toward accuracy`);
    }
});

test('the close target intercepts a non-piercing shot before a target beyond the muzzle', () => {
    const { shots } = fire('pistol'), near = target(325, 300), farther = target(340, 309);
    shots[0].update();
    new CollisionSystem().checkBulletEnemyCollisions(fixture(shots).controller, [farther.enemy, near.enemy]);
    assert.equal(near.damage.length, 1);
    assert.equal(farther.damage.length, 0);
    assert.equal(shots[0].isDead, true);
});

test('the launch segment neither hits behind the shooter nor remains active after a projectile leaves', () => {
    for (const id of ['rifle', 'shotgun', 'crossbow', 'laser', 'impulse'] as WeaponId[]) {
        const { shots } = fire(id), behind = target(275, 300);
        for (const shot of shots) shot.update();
        new CollisionSystem().checkBulletEnemyCollisions(fixture(shots).controller, [behind.enemy]);
        assert.equal(behind.damage.length, 0, `${id}: no backwards close-range hit`);
    }
    const { shots } = fire('rifle'), collision = new CollisionSystem(), f = fixture(shots);
    shots[0].update(); collision.checkBulletEnemyCollisions(f.controller, []);
    assert.equal(shots[0].launchOrigin, undefined);
    const late = target(325, 300);
    shots[0].update(); collision.checkBulletEnemyCollisions(f.controller, [late.enemy]);
    assert.equal(late.damage.length, 0, 'a past launch gap must not damage a later arrival');
});

test('continuous laser refreshes its close-range segment when the owner moves without charging another pulse', () => {
    const weapon = createWeapon('laser');
    const shots = weapon.tryFire(0, 300, 300, -Math.PI / 2)!;
    const beam = shots[0] as Beam, collision = new CollisionSystem(), f = fixture(shots);
    beam.update(16); collision.checkBulletEnemyCollisions(f.controller, []);
    const ammo = weapon.state.ammoRemaining;
    assert.equal(weapon.tryFire(16, 400, 300, Math.PI), null);
    const near = target(375, 300);
    collision.checkBulletEnemyCollisions(f.controller, [near.enemy]);
    assert.equal(near.damage.length, 1);
    assert.equal(weapon.state.ammoRemaining, ammo);
    weapon.tryFire(32, 400, 300, Math.PI);
    collision.checkBulletEnemyCollisions(f.controller, [near.enemy]);
    assert.equal(near.damage.length, 1, 'the same paid laser pulse cannot damage a touched target twice');
});

test('rear dual weapon uses its own owner pose for point-blank collisions', () => {
    const weapon = createWeapon('rifle'); weapon.setDualWeaponsActive(true);
    const shots = weapon.tryFire(0, 300, 300, 0)!;
    const rear = shots[1], pose = dualCharacterPose(300, 300, 0);
    assert.equal(rear.launchOrigin?.x, pose.x);
    assert.equal(rear.launchOrigin?.y, pose.y);
    const near = target(pose.x - 25, pose.y), behindRear = target(pose.x + 25, pose.y);
    rear.update();
    new CollisionSystem().checkBulletEnemyCollisions(fixture([rear]).controller, [behindRear.enemy, near.enemy]);
    assert.equal(near.damage.length, 1);
    assert.equal(behindRear.damage.length, 0);
});

test('a grenade hitting before the muzzle detonates at that near contact rather than its visual spawn', () => {
    const { shots } = fire('grenade-launcher'), grenade = shots[0] as Grenade;
    const muzzleX = grenade.x, near = target(325, 300), explosions: { x: number; y: number }[] = [];
    grenade.update(16);
    new CollisionSystem().checkBulletEnemyCollisions(fixture(shots).controller, [near.enemy],
        (x, y) => explosions.push({ x, y }));
    assert.equal(explosions.length, 1);
    assert.ok(explosions[0].x >= 300 && explosions[0].x < muzzleX);
    assert.ok(Math.hypot(explosions[0].x - near.enemy.x, explosions[0].y - near.enemy.y) <= near.enemy.radius + grenade.radius + 1e-6);
});
