import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { createProjectile } from '../src/entities/weapon/ProjectileFactory';
import { WEAPON_DEFINITIONS } from '../src/gameplay/weapons';
import { Bolt, ChainLightning, Disc, Pulse } from '../src/entities/bullet/SpecialProjectiles';
import type { Bullet } from '../src/entities/bullet/Bullet';
import { Enemy } from '../src/entities/enemy/Enemy';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import type { PlayerController } from '../src/systems/Player/PlayerController';

function fixture(bullets: Bullet[]) {
    let hits = 0;
    const controller = { getBullets: () => bullets, registerHit: () => hits++, registerProjectiles: () => {} } as unknown as PlayerController;
    return { controller, get hits() { return hits; } };
}
function trackedEnemy(x: number, y: number) {
    const enemy = new Enemy(x, y), received: number[] = [];
    enemy.receiveDamage = (amount) => { received.push(amount); };
    return { enemy, received };
}

test('crossbow fires five visible bolts for one cartridge, more than shotgun', () => {
    const weapon = createWeapon('crossbow'), ammo = weapon.state.ammoRemaining;
    const bolts = weapon.tryFire(0, 100, 100, 0)!;
    assert.equal(bolts.length, 5); assert.ok(bolts.every(b => b instanceof Bolt));
    assert.ok(bolts.length > createWeapon('shotgun').tryFire(0, 100, 100, 0)!.length);
    assert.equal(weapon.state.ammoRemaining, ammo - 1);
});

test('chain lightning jumps to three neighbors with diminishing damage and cannot strike twice', () => {
    const shot = new ChainLightning(0, 100, 0, 10, 10, 0); shot.x = 50;
    const targets = [50, 150, 250, 350, 450].map(x => trackedEnemy(x, 100));
    const f = fixture([shot]), collision = new CollisionSystem();
    collision.checkBulletEnemyCollisions(f.controller, targets.map(t => t.enemy));
    collision.checkBulletEnemyCollisions(f.controller, targets.map(t => t.enemy));
    assert.deepEqual(targets.map(t => t.received.length), [1, 1, 1, 1, 0]);
    [10, 7, 4.9, 3.43].forEach((damage, i) => assert.ok(Math.abs(targets[i].received[0] - damage) < 1e-8));
    assert.equal(f.hits, 1); assert.equal(shot.arcs.length, 5);
    shot.update(180); assert.equal(shot.expired, true);
});

test('chain lightning reaches wider groups up to 200 pixels but cannot bridge larger gaps', () => {
    for (const distance of [180, 200, 201, 250]) {
        const shot = new ChainLightning(0, 100, 0, 10, 10, 0); shot.x = 50;
        const a = trackedEnemy(50, 100), b = trackedEnemy(50 + distance, 100);
        new CollisionSystem().checkBulletEnemyCollisions(fixture([shot]).controller, [a.enemy, b.enemy]);
        assert.equal(a.received.length, 1);
        assert.equal(b.received.length, distance <= 200 ? 1 : 0, `gap ${distance}`);
    }
});

test('catalog Tesla reaches distant enemies instantly and missed discharges expire without later hits', () => {
    const shot = createWeapon('tesla').tryFire(0, 100, 100, 0)![0] as ChainLightning;
    const target = trackedEnemy(450, 100), f = fixture([shot]), collision = new CollisionSystem();
    shot.update(1000 / 60);
    collision.checkBulletEnemyCollisions(f.controller, [target.enemy]);
    assert.equal(target.received.length, 1);
    const miss = createWeapon('tesla').tryFire(0, 100, 100, 0)![0] as ChainLightning;
    const missed = fixture([miss]);
    collision.checkBulletEnemyCollisions(missed.controller, [trackedEnemy(700, 100).enemy]);
    assert.equal(miss.collisionResolved, true);
    collision.checkBulletEnemyCollisions(missed.controller, [target.enemy]);
    assert.equal(target.received.length, 1);
    miss.update(180); assert.equal(miss.expired, true); assert.equal(missed.hits, 0);
});

test('pulse hits a broad short area once, pushes survivors, and excludes distant targets', () => {
    const shot = new Pulse(100, 100, 0, .1, 85);
    const enemies = [new Enemy(180, 140), new Enemy(450, 100), new Enemy(40, 100)];
    const f = fixture([shot]), collision = new CollisionSystem();
    collision.checkBulletEnemyCollisions(f.controller, enemies);
    collision.checkBulletEnemyCollisions(f.controller, enemies);
    assert.equal(enemies[0].x, 265); assert.equal(enemies[1].x, 450); assert.equal(enemies[2].x, 40);
    assert.equal(f.hits, 1); shot.update(180); assert.equal(shot.expired, true);
});

test('disc hits at most three distinct enemies in travel order over multiple frames', () => {
    const shot = new Disc(0, 100, 0, .1, 10, 0), targets = [50, 100, 150, 200].map(x => trackedEnemy(x, 100));
    const f = fixture([shot]), collision = new CollisionSystem();
    shot.x = 50;
    collision.checkBulletEnemyCollisions(f.controller, targets.map(t => t.enemy));
    collision.checkBulletEnemyCollisions(f.controller, targets.map(t => t.enemy));
    assert.equal(targets[0].received.length, 1); assert.equal(shot.collisionResolved, false);
    shot.previousX = 50; shot.x = 250;
    collision.checkBulletEnemyCollisions(f.controller, targets.map(t => t.enemy).reverse());
    assert.deepEqual(targets.map(t => t.received.length), [1, 1, 1, 0]);
    assert.equal(shot.isDead, true); assert.equal(f.hits, 1);
});

test('electric pulse covers both fan flanks at any aim angle without hitting behind or beyond the sector', () => {
    for (const angle of [0, Math.PI / 2, Math.PI, -.7]) {
        const shot = new Pulse(300, 300, angle, 1, 0);
        const local = [[120, 80], [120, -80], [80, 0], [-10, 0], [60, 100], [210, 0]];
        const targets = local.map(([x, y]) => trackedEnemy(300 + x * Math.cos(angle) - y * Math.sin(angle), 300 + x * Math.sin(angle) + y * Math.cos(angle)));
        const f = fixture([shot]), collision = new CollisionSystem();
        collision.checkBulletEnemyCollisions(f.controller, targets.map(t => t.enemy));
        collision.checkBulletEnemyCollisions(f.controller, targets.map(t => t.enemy));
        assert.deepEqual(targets.map(t => t.received.length), [1, 1, 1, 0, 0, 0]);
        assert.equal(f.hits, 1);
    }
    const shot = new Pulse(0, 0, 0, 1, 0);
    assert.equal(shot.intersects(180, 0, 20), true, 'large target overlaps range edge');
    assert.equal(shot.intersects(145, 120, 15), false, 'outer corner stays outside fan');
});

test('acid scales independently, refreshes without stacking and expires alongside independent burn', () => {
    const def = WEAPON_DEFINITIONS['acid-gun'];
    const shot = createProjectile(def, 100, 100, 0, def.damage, 2);
    assert.equal(shot.effect!.acidDps, def.effect!.acidDps! * 2);
    assert.equal(def.effect!.acidDps, 3);
    const target = trackedEnemy(100, 100);
    const effect = { acidDps: 2, acidMs: 500, burnDps: 1, burnMs: 1000 };
    target.enemy.applyEffect(effect); target.enemy.applyEffect(effect);
    target.enemy.update(750); target.enemy.update(750); target.enemy.update(750);
    assert.deepEqual(target.received, [.75, 1, .25]);
});
