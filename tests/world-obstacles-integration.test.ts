import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Enemy } from '../src/entities/enemy/Enemy';
import { Player } from '../src/entities/player/Player';
import { resetArena } from '../src/gameplay/Arena';
import { getArenaBarrels, getArenaSolidPolygons } from '../src/gameplay/ArenaObstacles';
import type { PlayerController } from '../src/systems/Player/PlayerController';
import { GameWorld } from '../src/systems/GameWorld';

function withWorld(run: (world: GameWorld, player: Player, enemies: Enemy[], move: (step: () => void) => void) => void) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { innerWidth: 1000, innerHeight: 700 } });
    resetArena();
    let step = () => {};
    const player = new Player(500, 350);
    const controller = {
        getPlayer: () => player, update: () => step(), getBullets: () => [], cleanupBullets() {},
        getAimPosition: () => ({ x: 500, y: 350 }), registerKill() {}, acquiredAmmoCategories: [], isMoving: true,
    } as unknown as PlayerController;
    const world = new GameWorld(controller, () => .99, [], []);
    try { run(world, player, (world as unknown as { enemies: Enemy[] }).enemies, next => { step = next; }); }
    finally {
        world.dispose(); resetArena();
        if (previous) Object.defineProperty(globalThis, 'window', previous);
        else Reflect.deleteProperty(globalThis, 'window');
    }
}

function assertOutsideSlab(body: { x: number; y: number; radius: number }, polygon: { x: number; y: number }[]) {
    let inside = false, nearest = Infinity;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[j], b = polygon[i];
        if ((a.y > body.y) !== (b.y > body.y) && body.x < a.x + (b.x - a.x) * (body.y - a.y) / (b.y - a.y)) inside = !inside;
        const dx = b.x - a.x, dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((body.x - a.x) * dx + (body.y - a.y) * dy) / (dx * dx + dy * dy)));
        nearest = Math.min(nearest, Math.hypot(body.x - a.x - t * dx, body.y - a.y - t * dy));
    }
    assert.equal(inside, false, 'body center must be outside the solid slab');
    assert.ok(nearest >= body.radius - 1e-5, 'body radius must not overlap a solid slab');
}

test('world blocks swept player and enemy movement through the same barrel', () => withWorld((world, player, enemies, move) => {
    const barrel = getArenaBarrels(1000, 700)[0];
    player.x = barrel.x - 80; player.y = barrel.y;
    const enemy = new Enemy(barrel.x - 80, barrel.y + 1);
    enemy.contactDisabled = true;
    enemy.update = () => { enemy.x = barrel.x + 80; };
    enemies.push(enemy);
    move(() => { player.x = barrel.x + 80; });
    world.update(16);
    for (const body of [player, enemy]) {
        assert.ok(Math.hypot(body.x - barrel.x, body.y - barrel.y) >= body.radius + barrel.radius - 1e-5);
        assert.ok(body.x < barrel.x, 'swept collision must keep both actors on the approach side');
    }
}));

test('world blocks swept player and enemy movement through the visible concrete slab', () => withWorld((world, player, enemies, move) => {
    const slab = getArenaSolidPolygons(1000, 700)[0];
    player.x = 35; player.y = 168;
    const enemy = new Enemy(35, 169);
    enemy.contactDisabled = true;
    enemy.update = () => { enemy.x = 270; };
    enemies.push(enemy);
    move(() => { player.x = 270; });
    world.update(16);
    for (const body of [player, enemy]) {
        assertOutsideSlab(body, slab);
        assert.ok(body.x < 140, 'actors must not emerge through the far side of the slab');
    }
}));

test('world clears barrel penetration introduced by player contact and enemy separation later in the tick', () => withWorld((world, player, enemies) => {
    const barrel = getArenaBarrels(1000, 700)[0];
    player.x = barrel.x - barrel.radius - player.radius; player.y = barrel.y;
    const contact = new Enemy(player.x - player.radius - 12, player.y);
    contact.update = () => {};
    const near = new Enemy(barrel.x + barrel.radius + 15, barrel.y);
    const pushing = new Enemy(near.x + 20, near.y);
    near.contactDisabled = pushing.contactDisabled = true;
    near.update = pushing.update = () => {};
    enemies.push(contact, near, pushing);
    const hp = player.currentHp;
    world.update(16);
    assert.ok(player.currentHp < hp, 'real player-enemy contact should have happened');
    assert.ok(pushing.x > barrel.x + barrel.radius + 35, 'real crowd separation should have moved the overlapping enemy');
    for (const body of [player, ...enemies]) {
        assert.ok(Math.hypot(body.x - barrel.x, body.y - barrel.y) >= body.radius + barrel.radius - 1e-5,
            'final obstacle recovery must clear contact and crowd pushback');
    }
}));

test('late crowd displacement cannot move player or enemy completely through a solid slab', () => withWorld((world, player, enemies) => {
    const slab = getArenaSolidPolygons(1000, 700)[0];
    player.x = 35; player.y = 168;
    const enemy = new Enemy(35, 169);
    enemy.contactDisabled = true;
    enemy.update = () => {};
    enemies.push(enemy);
    let displaced = false;
    const internal = world as unknown as { separation: { resolve: (crowd: Enemy[]) => void } };
    internal.separation.resolve = crowd => {
        assert.equal(crowd[0], enemy);
        // Model accumulated late contact/crowd forces: both endpoints lie outside
        // the slab, so a final overlap-only correction cannot detect the crossing.
        player.x = 270; enemy.x = 270; displaced = true;
        assertOutsideSlab(player, slab);
        assertOutsideSlab(enemy, slab);
    };
    world.update(16);
    assert.equal(displaced, true, 'late displacement hook must have run');
    for (const body of [player, enemy]) {
        assertOutsideSlab(body, slab);
        assert.ok(body.x < 140, 'final recovery must sweep from the last valid position');
    }
}));
