import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FixedStep, STEP_MS } from '../src/core/FixedStep';
import { SpatialGrid } from '../src/systems/spatial/SpatialGrid';
import { EnemySeparation } from '../src/systems/spatial/EnemySeparation';
import { segmentHit } from '../src/systems/spatial/segmentHit';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { resolvePlayerContact } from '../src/systems/spatial/playerContact';
import { Player } from '../src/entities/player/Player';
import { Enemy } from '../src/entities/enemy/Enemy';
import { Bullet } from '../src/entities/bullet/Bullet';
import { Grenade } from '../src/entities/bullet/Grenade';
import type { PlayerController } from '../src/systems/Player/PlayerController';
import { WeaponState } from '../src/gameplay/WeaponState';
import { WaveSystem } from '../src/systems/WaveSystem/WaveSystem';
import { EnemyType } from '../src/entities/enemy/EnemyType';

function controller(bullets: Bullet[]) {
    let hits = 0;
    return { getBullets: () => bullets, getPlayer: () => ({ x: 0, y: 0 }), registerHit: () => hits++,
        get hits() { return hits; } } as unknown as PlayerController & { hits: number };
}

test('30/60/144 Hz render schedules produce the same 60 Hz motion and cooldowns', () => {
    const results = [30, 60, 144].map(fps => {
        const clock = new FixedStep(), weapon = new WeaponState({ kind: 'infinite' }, 300);
        let time = 0, distance = 0, shots = 0;
        for (let i = 0; i <= fps * 10; i++) clock.advance(i * 1000 / fps, dt => {
            time += dt; distance += 5; if (weapon.consumeShot(time)) shots++;
        });
        return { distance, shots };
    });
    assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]);
    assert.equal(results[0].distance, 3000);
});

test('stall catch-up is bounded; reset discards time spent paused', () => {
    assert.throws(() => new FixedStep(0));
    const clock = new FixedStep(); let steps = 0;
    clock.advance(0, () => steps++);
    assert.equal(clock.advance(10000, () => steps++), 5);
    assert.ok(clock.droppedMs > 9900);
    clock.reset(); clock.advance(100000, () => steps++);
    assert.equal(steps, 5);
    clock.advance(100000 + STEP_MS, () => steps++);
    assert.equal(steps, 6);
});

test('projectile leaving the viewport still hits a crossed target before cleanup', () => {
    const bullet = new Bullet(0, 0, 0, 3);
    bullet.x = 300; bullet.expired = true;
    const enemy = new Enemy(100, 0), c = controller([bullet]);
    new CollisionSystem().checkBulletEnemyCollisions(c, [enemy]);
    assert.equal(enemy.isDead, true); assert.equal(bullet.hitRegistered, true);
});

test('grid queries and unique pair enumeration cover brute-force contacts, including large and negative bodies', () => {
    let seed = 17;
    const rand = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 2 ** 32; };
    const bodies = Array.from({ length: 250 }, (_, id) => ({ id, x: rand() * 1000 - 500, y: rand() * 1000 - 500, radius: 5 + rand() * 100 }));
    const grid = new SpatialGrid<(typeof bodies)[number]>(40); grid.rebuild(bodies);
    const pairs = new Set<string>();
    grid.forEachPair((a, b) => { const key = [a.id, b.id].sort((a, b) => a - b).join(':'); assert.ok(!pairs.has(key)); pairs.add(key); });
    const candidates: typeof bodies = [];
    for (const a of bodies) {
        grid.query(a.x - a.radius, a.y - a.radius, a.x + a.radius, a.y + a.radius, candidates);
        assert.equal(new Set(candidates).size, candidates.length);
        for (const b of bodies) {
            if (a.id >= b.id || Math.hypot(a.x - b.x, a.y - b.y) > a.radius + b.radius) continue;
            assert.ok(candidates.includes(b)); assert.ok(pairs.has(`${a.id}:${b.id}`));
        }
    }
    const moved = bodies[0]; moved.x = -3000; grid.relocate(moved);
    grid.query(-3001, moved.y - 1, -2999, moved.y + 1, candidates); assert.ok(candidates.includes(moved));
    grid.rebuild([]); grid.query(-1, -1, 1, 1, candidates); assert.equal(candidates.length, 0);
});

test('swept projectile hits the first target even when its endpoint passed both targets', () => {
    const far = new Enemy(80, 0), near = new Enemy(30, 0);
    const bullet = new Bullet(0, 0, 0, 3); bullet.x = 120;
    const c = controller([bullet]);
    new CollisionSystem().checkBulletEnemyCollisions(c, [far, near]);
    assert.equal(near.isDead, true); assert.equal(far.isDead, false); assert.equal(c.hits, 1);
    assert.equal(segmentHit(0, 0, 0, 0, 0, 0, 1), 0);
    assert.equal(segmentHit(0, 0, 0, 0, 5, 0, 1), null);
});

test('knockback relocation keeps subsequent shots valid across grid boundaries', () => {
    const enemy = new Enemy(63, 0);
    const first = new Bullet(63, 0, 0, .1, 10, 150);
    const second = new Bullet(213, 0, 0, 3);
    const c = controller([first, second]); new CollisionSystem().checkBulletEnemyCollisions(c, [enemy]);
    assert.equal(c.hits, 2); assert.equal(enemy.isDead, true);
});

test('grenade blast affects nearby targets once and misses distant enemies', () => {
    const grenade = new Grenade(0, 0, 0, 20, 0, 0); grenade.detonated = true;
    const enemies = [new Enemy(0, 0), new Enemy(70, 0), new Enemy(200, 0)];
    const c = controller([grenade]); let explosions = 0;
    const collisions = new CollisionSystem();
    collisions.checkBulletEnemyCollisions(c, enemies, () => explosions++);
    collisions.checkBulletEnemyCollisions(c, enemies, () => explosions++);
    assert.equal(c.hits, 1); assert.equal(explosions, 1);
    assert.deepEqual(enemies.map(enemy => enemy.isDead), [true, true, false]);
});

test('coincident enemies separate without NaN or unbounded displacement', () => {
    const enemies = Array.from({ length: 200 }, () => new Enemy(100, 100));
    const separation = new EnemySeparation(); separation.resolve(enemies);
    for (const enemy of enemies) {
        assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.y));
        assert.ok(Math.hypot(enemy.x - 100, enemy.y - 100) <= enemy.radius + 1e-6);
    }
    assert.ok(enemies.some(enemy => enemy.x !== 100));
});

test('contact damage occurs once per cooldown and coincident centers remain finite', () => {
    const player = new Player(100, 100), enemy = new Enemy(100, 100);
    resolvePlayerContact(player, enemy, false, 0, 1000, 1000);
    assert.equal(player.currentHp, 98);
    enemy.x = player.x; enemy.y = player.y;
    resolvePlayerContact(player, enemy, false, 100, 1000, 1000);
    assert.equal(player.currentHp, 98);
    enemy.x = player.x; enemy.y = player.y;
    resolvePlayerContact(player, enemy, false, 600, 1000, 1000);
    assert.equal(player.currentHp, 96); assert.ok(Number.isFinite(player.x));
});

test('spatial index preserves legacy candidate and pair ordering across pooled rebuilds', () => {
    const grid = new SpatialGrid<{ id: number; x: number; y: number; radius: number }>(40);
    let seed = 73;
    const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 2 ** 32; };
    for (const count of [150, 0, 20, 200]) {
        const bodies = Array.from({ length: count }, (_, id) => ({ id, x: random() * 400 - 200, y: random() * 400 - 200, radius: 5 + random() * 50 }));
        const cells = new Map<string, typeof bodies>();
        for (const body of bodies) {
            const key = `${Math.floor(body.x / 40)},${Math.floor(body.y / 40)}`;
            const bucket = cells.get(key) ?? [];
            if (!cells.has(key)) cells.set(key, bucket);
            bucket.push(body);
        }
        grid.rebuild(bodies);
        const expectedPairs: string[] = [], actualPairs: string[] = [];
        const reach = Math.ceil(2 * Math.max(0, ...bodies.map(body => body.radius)) / 40);
        for (const [key, bucket] of cells) {
            const [cx, cy] = key.split(',').map(Number);
            for (let i = 0; i < bucket.length; i++) for (let j = i + 1; j < bucket.length; j++) expectedPairs.push(`${bucket[i].id}:${bucket[j].id}`);
            for (let dy = 0; dy <= reach; dy++) for (let dx = dy === 0 ? 1 : -reach; dx <= reach; dx++) {
                for (const a of bucket) for (const b of cells.get(`${cx + dx},${cy + dy}`) ?? []) expectedPairs.push(`${a.id}:${b.id}`);
            }
        }
        grid.forEachPair((a, b) => actualPairs.push(`${a.id}:${b.id}`));
        assert.deepEqual(actualPairs, expectedPairs);
        const candidates: typeof bodies = [];
        grid.query(-40, -40, 40, 40, candidates);
        const expected: typeof bodies = [];
        for (let y = Math.floor((-40 - grid.maxRadius) / 40); y <= Math.floor((40 + grid.maxRadius) / 40); y++) {
            for (let x = Math.floor((-40 - grid.maxRadius) / 40); x <= Math.floor((40 + grid.maxRadius) / 40); x++) expected.push(...cells.get(`${x},${y}`) ?? []);
        }
        assert.deepEqual(candidates, expected);
    }
});

test('relocation handles repeated moves and radius growth without stale or duplicate entries', () => {
    const body = { x: 0, y: 0, radius: 1 }, companion = { x: 1, y: 0, radius: 1 };
    const grid = new SpatialGrid<typeof body>(40), candidates: typeof body[] = [];
    grid.rebuild([body, companion]);
    for (const x of [-400, 400, 0]) {
        body.x = x; grid.relocate(body);
        grid.query(-500, -500, 500, 500, candidates);
        assert.equal(candidates.filter(candidate => candidate === body).length, 1);
        assert.ok(candidates.includes(companion));
    }
    body.radius = 120; grid.relocate(body);
    grid.query(110, 0, 110, 0, candidates);
    assert.ok(candidates.includes(body));
    grid.rebuild([companion]);
    grid.query(-500, -500, 500, 500, candidates);
    assert.deepEqual(candidates, [companion]);
    assert.equal(grid.maxRadius, 1);
});

test('default wave progression and random draw order remain unchanged without browser globals', () => {
    const values = [0, 0, .5, 0, .25, .5, 0, .5, .5, 0, .75, .5];
    let index = 0;
    const waves = new WaveSystem({ random: () => values[index++ % values.length], viewport: () => ({ width: 800, height: 600 }) });
    const first = waves.spawnWave();
    assert.deepEqual(first.slice(0, 4).map(({ x, y }) => ({ x, y })), [
        { x: 400, y: -50 }, { x: 400, y: 650 }, { x: -50, y: 300 }, { x: 850, y: 300 },
    ]);
    assert.equal(index, 15);
    assert.deepEqual([first.length, ...Array.from({ length: 5 }, () => waves.spawnWave().length)], [5, 10, 4, 7, 7, 7]);
});

test('custom wave rules repeat their final wave and read current arena dimensions', () => {
    let width = 800;
    const waves = new WaveSystem({ rules: [{ types: [EnemyType.TANK], count: 1 }], random: () => .9, viewport: () => ({ width, height: 600 }) });
    const first = waves.spawnWave()[0];
    assert.equal(first.radius, 25); assert.equal(first.x, 850);
    width = 1200;
    assert.equal(waves.spawnWave()[0].x, 1250);
    assert.throws(() => new WaveSystem({ rules: [] }));
    assert.throws(() => new WaveSystem({ rules: [{ types: [], count: 1 }] }));
    assert.throws(() => new WaveSystem({ rules: [{ types: [EnemyType.GRUNT], count: -1 }] }));
});
