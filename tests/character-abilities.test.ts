import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARACTER_ABILITIES, CharacterAbilityClock } from '../src/gameplay/CharacterAbilities';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType } from '../src/entities/enemy/EnemyType';
import { Player } from '../src/entities/player/Player';
import { GameWorld } from '../src/systems/GameWorld';
import type { PlayerController } from '../src/systems/Player/PlayerController';
import type { CharacterId } from '../src/gameplay/ids';

test('ability cooldown starts on activation, pauses with simulation and resets for a new run', () => {
    const clock = new CharacterAbilityClock(CHARACTER_ABILITIES.mercenary);
    assert.equal(clock.activate(), true);
    assert.equal(clock.activate(), false);
    clock.update(0); assert.equal(clock.state!.remainingActiveMs, 8000);
    clock.update(7999); assert.equal(clock.state!.remainingActiveMs, 1);
    clock.update(1); assert.equal(clock.state!.remainingActiveMs, 0);
    assert.equal(clock.state!.remainingCooldownMs, 37000);
    clock.update(37000); assert.equal(clock.activate(), true);
    assert.equal(new CharacterAbilityClock(CHARACTER_ABILITIES.mercenary).activate(), true);
    assert.equal(new CharacterAbilityClock().activate(), false);
});

function withWorld(character: CharacterId, run: (world: GameWorld, player: Player,
    internals: { enemies: Enemy[]; elapsed: number }, state: { kills: number; dual: boolean }) => void) {
    const previousWindow = globalThis.window;
    globalThis.window = { innerWidth: 1000, innerHeight: 800 } as Window & typeof globalThis;
    try {
        const player = new Player(); player.character = character; player.x = 400; player.y = 400;
        const state = { kills: 0, dual: false };
        const controller = {
            getPlayer: () => player, update: () => {}, getBullets: () => [], cleanupBullets: () => {},
            registerKill: () => state.kills++, isMoving: false, acquiredAmmoCategories: [],
            setDualWeaponsActive: (active: boolean) => { state.dual = active; },
        } as unknown as PlayerController;
        const world = new GameWorld(controller, () => .999, [], []);
        const internal = world as unknown as { enemies: Enemy[]; elapsed: number; stampBlood: () => void };
        internal.stampBlood = () => {};
        run(world, player, internal, state);
    } finally { globalThis.window = previousWindow; }
}

test('artillery hits visible enemies exactly once, credits kills, and excludes offscreen enemies', () => {
    withWorld('destroyer', (world, _player, internal, state) => {
        const boss = new Enemy(900, 700, EnemyType.BOSS), offscreen = new Enemy(1100, 400);
        internal.enemies.push(boss, offscreen, new Enemy(300, 200));
        assert.equal(world.activateAbility(), true);
        assert.equal(world.activateAbility(), false);
        assert.equal(state.kills, 1); assert.equal(offscreen.isDead, false);
        world.update(500); world.update(500);
        boss.receiveDamage(13.9); assert.equal(boss.isDead, false, 'visual bursts must not deal extra damage');
        boss.receiveDamage(.2); assert.equal(boss.isDead, true);
    });
});

test('fear fixes affected enemies in place, blocks contact damage and excludes later arrivals', () => {
    withWorld('assassin', (world, player, internal) => {
        const overlapping = new Enemy(400, 400), nearby = new Enemy(405, 400);
        const boundary = new Enemy(715, 400), outside = new Enemy(715.01, 400);
        internal.enemies.push(overlapping, nearby, boundary, outside);
        world.activateAbility();
        assert.equal(boundary.isFeared, true); assert.equal(outside.isFeared, false);
        const hp = player.currentHp;
        world.update(16);
        assert.equal(player.currentHp, hp);
        assert.deepEqual([overlapping.x, overlapping.y, nearby.x, nearby.y], [400, 400, 405, 400]);
        assert.equal(overlapping.canDamage(1000), false);
        nearby.receiveDamage(.1, 0, 100); assert.equal(nearby.x, 405, 'fear prevents hit displacement');
        const arrival = new Enemy(450, 400); internal.enemies.push(arrival);
        world.update(16); assert.equal(arrival.isFeared, false);
        overlapping.update(4968); assert.equal(overlapping.isFeared, false);
        assert.equal(overlapping.canDamage(6000), true);
    });
});

test('dual weapons expire on simulation time, and dead or finished runs cannot activate abilities', () => {
    withWorld('mercenary', (world, player, internal, state) => {
        assert.equal(world.activateAbility(), true); assert.equal(state.dual, true);
        world.update(7999); assert.equal(state.dual, true);
        world.update(1); assert.equal(state.dual, false);
        player.currentHp = 0;
        assert.equal(world.activateAbility(), false);
        const cooldown = world.abilityState!.remainingCooldownMs;
        world.update(1000); assert.equal(world.abilityState!.remainingCooldownMs, cooldown);
        player.currentHp = 100; internal.elapsed = GameWorld.DURATION_MS;
        assert.equal(world.activateAbility(), false);
    });
    withWorld('goliath', world => { assert.equal(world.abilityState, null); assert.equal(world.activateAbility(), false); });
});
