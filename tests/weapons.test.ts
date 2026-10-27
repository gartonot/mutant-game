import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { WEAPON_DEFINITIONS } from '../src/gameplay/weapons';
import { Beam } from '../src/entities/bullet/Beam';
import { Grenade } from '../src/entities/bullet/Grenade';
import { Flame } from '../src/entities/bullet/Flame';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType } from '../src/entities/enemy/EnemyType';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import type { Bullet } from '../src/entities/bullet/Bullet';
import type { PlayerController } from '../src/systems/Player/PlayerController';

function fixture(bullets: Bullet[]) {
    let hits = 0, fragments = 0;
    const controller = { getBullets: () => bullets, registerHit: () => hits++, registerProjectiles: (n: number) => fragments += n } as unknown as PlayerController;
    return { controller, get hits() { return hits; }, get fragments() { return fragments; } };
}
test('all fourteen catalog weapons fire and consume their configured ammunition', () => {
    assert.equal(Object.keys(WEAPON_DEFINITIONS).length, 14);
    for (const d of Object.values(WEAPON_DEFINITIONS)) {
        const w = createWeapon(d.id), delay = d.chargeMs ?? d.spinUpMs;
        if (delay) assert.equal(w.tryFire(0, 100, 100, 0), null);
        const bullets = w.tryFire(delay ?? 0, 100, 100, 0);
        assert.equal(bullets?.length, d.pellets.length, d.id);
        assert.equal(w.state.ammoRemaining, d.ammo.kind === 'finite' ? d.ammo.initial - 1 : Infinity);
    }
});
test('double barrel spends two shells across two shots, finishes after release, then reloads', () => {
    const w = createWeapon('double-barrel');
    assert.equal(w.tryFire(0, 0, 0, 0)?.length, 4);
    assert.equal(w.state.ammoRemaining, 39);
    assert.equal(w.tryFire(100, 0, 0, 0), null);
    assert.equal(w.tryFire(110, 0, 0, 0, undefined, false)?.length, 4);
    assert.equal(w.state.ammoRemaining, 38);
    assert.equal(w.tryFire(1200, 0, 0, 0), null);
    assert.equal(w.tryFire(1310, 0, 0, 0)?.length, 4);
    w.resetTrigger(1320);
    assert.equal(w.tryFire(1430, 0, 0, 0), null);
});
test('machine gun spins up again after release and plasma charge cancellation spends nothing', () => {
    const m = createWeapon('machine-gun');
    assert.equal(m.tryFire(0, 0, 0, 0), null);
    assert.equal(m.tryFire(449, 0, 0, 0), null);
    assert.ok(m.tryFire(450, 0, 0, 0));
    assert.ok(m.tryFire(510, 0, 0, 0));
    m.tryFire(520, 0, 0, 0, undefined, false);
    assert.equal(m.tryFire(600, 0, 0, 0), null);
    assert.ok(m.tryFire(1050, 0, 0, 0));
    const p = createWeapon('plasma-cannon');
    p.tryFire(0, 0, 0, 0); p.tryFire(250, 0, 0, 0);
    assert.ok(p.chargeProgress > 0);
    p.resetTrigger(250);
    assert.equal(p.state.ammoRemaining, 30);
    assert.equal(p.tryFire(500, 0, 0, 0), null);
    assert.equal(p.tryFire(949, 0, 0, 0), null);
    assert.ok(p.tryFire(950, 0, 0, 0)?.[0] instanceof Beam);
});
test('beam pierces multiple enemies, resolves once, and excludes enemies outside its width', () => {
    const beam = new Beam(0, 100, 0, 1, 0, false);
    const enemies = [new Enemy(100, 100), new Enemy(200, 100), new Enemy(100, 150)];
    const f = fixture([beam]), collisions = new CollisionSystem();
    collisions.checkBulletEnemyCollisions(f.controller, enemies);
    collisions.checkBulletEnemyCollisions(f.controller, enemies);
    assert.equal(f.hits, 1);
    assert.deepEqual(enemies.map(e => e.isDead), [false, false, false]);
    const second = new Beam(0, 100, 0, 2, 0, false);
    collisions.checkBulletEnemyCollisions(fixture([second]).controller, enemies);
    assert.deepEqual(enemies.map(e => e.isDead), [true, true, false]);
});
test('burn damages over time without multiplying on reapplication; slow expires', () => {
    const e = new Enemy(0, 0); e.setTarget(100, 0);
    const effect = { burnDps: 1.5, burnMs: 1500, slowFactor: .5, slowMs: 1000 };
    e.applyEffect(effect); e.applyEffect(effect);
    e.update(500); assert.equal(e.isDead, false); assert.equal(e.x, .5);
    e.update(500); assert.equal(e.isDead, false); assert.equal(e.x, 1);
    e.update(500); assert.equal(e.isDead, true);
    const survivor = new Enemy(0, 0); survivor.setTarget(100, 0); survivor.applyEffect({ slowMs: 100, slowFactor: .5 });
    survivor.update(100); survivor.update(100); assert.equal(survivor.x, 1.5);
});
test('flame ignites crossed enemies without immediate damage and touches each once per puff', () => {
    const flame = createWeapon('flamethrower').tryFire(0, 0, 0, 0)![1] as Flame;
    const enemy = new Enemy(flame.x, flame.y), f = fixture([flame]), collisions = new CollisionSystem();
    collisions.checkBulletEnemyCollisions(f.controller, [enemy]);
    collisions.checkBulletEnemyCollisions(f.controller, [enemy]);
    assert.equal(enemy.isDead, false); assert.equal(flame.touched.size, 1); assert.equal(f.hits, 1);
    enemy.update(1000); assert.equal(enemy.isDead, true);
});
test('skull explosion creates eight damaging fragments once; plasma blast slows nearby survivors', () => {
    const skull = createWeapon('skull-launcher').tryFire(0, 0, 0, 0)![0] as Grenade;
    skull.detonated = true;
    const bullets = [skull], f = fixture(bullets), collisions = new CollisionSystem();
    collisions.checkBulletEnemyCollisions(f.controller, []);
    assert.equal(f.fragments, 8); assert.equal(bullets.length, 9);
    collisions.checkBulletEnemyCollisions(f.controller, []); assert.equal(bullets.length, 9);
    assert.ok(bullets.slice(1).every(b => b.damage === 3));
    const plasma = createWeapon('plasma-grenade').tryFire(0, 0, 0, 0)![0] as Grenade;
    plasma.detonated = true;
    const enemy = new Enemy(plasma.x, plasma.y, EnemyType.BOSS);
    collisions.checkBulletEnemyCollisions(fixture([plasma]).controller, [enemy]);
    const oldX = enemy.x; enemy.setTarget(oldX + 100, enemy.y); enemy.update();
    assert.ok(Math.abs(enemy.x - oldX - .55) < 1e-8);
});

test('laser tracks between ammo ticks and hits a target swept over during fast aim changes', () => {
    const laser = createWeapon('laser');
    const beam = laser.tryFire(0, 100, 100, -.25)![0] as Beam;
    const enemy = new Enemy(400, 100), behind = new Enemy(0, 100);
    const f = fixture([beam]), collisions = new CollisionSystem();
    collisions.checkBulletEnemyCollisions(f.controller, [enemy, behind]);
    assert.equal(f.hits, 0);
    assert.equal(laser.tryFire(16, 100, 100, .25), null);
    assert.equal(laser.state.ammoRemaining, 199);
    collisions.checkBulletEnemyCollisions(f.controller, [enemy, behind]);
    assert.equal(f.hits, 1); assert.equal(enemy.isDead, false); assert.equal(behind.isDead, false);
    laser.tryFire(32, 100, 100, 0);
    collisions.checkBulletEnemyCollisions(f.controller, [enemy]);
    assert.equal(enemy.isDead, false, 'same paid pulse must not damage twice');
    const next = laser.tryFire(65, 100, 100, 0)![0];
    collisions.checkBulletEnemyCollisions(fixture([next]).controller, [enemy]);
    assert.equal(enemy.isDead, true); assert.equal(laser.state.ammoRemaining, 198);
});
test('laser sweep continues across pulse boundary; release and switching terminate it', () => {
    const laser = createWeapon('laser');
    const old = laser.tryFire(0, 100, 100, -.25)![0];
    const next = laser.tryFire(65, 100, 100, .25)![0];
    assert.equal(old.isDead, true);
    const enemy = new Enemy(400, 100), f = fixture([next]);
    new CollisionSystem().checkBulletEnemyCollisions(f.controller, [enemy]);
    assert.equal(f.hits, 1);
    laser.tryFire(70, 100, 100, 0, undefined, false);
    assert.equal(next.isDead, true);
    const restarted = laser.tryFire(130, 100, 100, 0)![0];
    laser.resetTrigger(135); assert.equal(restarted.isDead, true);
});
test('last laser cartridge sustains its paid interval and slowed attack speed does not expire it early', () => {
    const laser = createWeapon('laser', 1, .5);
    for (let i = 0; i < 199; i++) laser.state.consumeShot(i * 130);
    const start = 199 * 130;
    const beam = laser.tryFire(start, 100, 100, 0)![0] as Beam;
    assert.equal(laser.state.ammoRemaining, 0);
    for (let elapsed = 16; elapsed < 130; elapsed += 16) {
        laser.tryFire(start + elapsed, 100, 100, .1); beam.update(16);
        assert.equal(beam.expired, false); assert.equal(beam.isDead, false);
    }
    assert.equal(laser.tryFire(start + 130, 100, 100, .1), null);
    assert.equal(beam.isDead, true);
});

test('continuous weapons hide cursor cooldown while ordinary weapons retain it', () => {
    for (const id of ['flamethrower', 'laser', 'plasma-auto'] as const) {
        const w = createWeapon(id); w.tryFire(0, 0, 0, 0);
        assert.equal(w.cursorProgress(1), null, id);
    }
    const pistol = createWeapon('pistol');
    assert.equal(pistol.cursorProgress(0), null);
    pistol.tryFire(0,0,0,0); assert.equal(pistol.cursorProgress(300), .5);
    assert.equal(pistol.cursorProgress(600), null);
});
test('double barrel shows cursor reload only after the second shot', () => {
    const w = createWeapon('double-barrel');
    w.tryFire(0,0,0,0); assert.equal(w.cursorProgress(55), null);
    w.tryFire(110,0,0,0); assert.equal(w.cursorProgress(110), 0);
    assert.equal(w.cursorProgress(710), .5); assert.equal(w.cursorProgress(1310), null);
});
test('machine gun cursor displays spin-up from the press, never individual shot cooldowns', () => {
    const w = createWeapon('machine-gun');
    assert.equal(w.cursorProgress(0), null);
    assert.equal(w.tryFire(0,0,0,0), null); assert.equal(w.cursorProgress(0), 0);
    w.tryFire(225,0,0,0); assert.equal(w.cursorProgress(225), .5);
    assert.ok(w.tryFire(450,0,0,0)); assert.equal(w.cursorProgress(451), null);
    assert.ok(w.tryFire(510,0,0,0)); assert.equal(w.cursorProgress(511), null);
    w.tryFire(512,0,0,0,undefined,false); assert.equal(w.cursorProgress(512), null);
    w.tryFire(513,0,0,0); assert.equal(w.cursorProgress(513),0);
    assert.equal(w.tryFire(962,0,0,0),null); assert.ok(w.tryFire(963,0,0,0));
    assert.equal(w.cursorProgress(963),null);
    w.resetTrigger(964); assert.equal(w.cursorProgress(964),null);
});
