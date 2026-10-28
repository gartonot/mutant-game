import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameWorld } from '../src/GameRuntime';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType } from '../src/entities/enemy/EnemyType';
import { CHARACTER_ABILITIES } from '../src/gameplay/CharacterAbilities';
import type { CharacterId } from '../src/gameplay/ids';
import type { GameWorld } from '../src/systems/GameWorld';
import { planPlasmaTraps } from '../src/gameplay/PlasmaTraps';

function withWorld(character: CharacterId, run: (world: GameWorld, enemies: Enemy[]) => void): void {
    const previous = ['window', 'document', 'HTMLCanvasElement'].map(key =>
        [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
    class Canvas {}
    const context = new Proxy({}, { get: (_target, key) => key === 'createRadialGradient'
        ? () => ({ addColorStop() {} }) : () => {} });
    const win = Object.assign(new EventTarget(), { innerWidth: 1200, innerHeight: 800 });
    const doc = Object.assign(new EventTarget(), { hidden: false,
        createElement: () => ({ width: 1200, height: 800, getContext: () => context }) });
    for (const [key, value] of Object.entries({ window: win, document: doc, HTMLCanvasElement: Canvas })) {
        Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    let world: GameWorld | undefined;
    try {
        world = createGameWorld(undefined, character);
        const internal = world as unknown as { enemies: Enemy[]; stampBlood: () => void; random: () => number };
        internal.stampBlood = () => {};
        internal.random = () => .999;
        run(world, internal.enemies);
    } finally {
        world?.dispose();
        world?.getPlayerController().dispose();
        for (const [key, descriptor] of previous) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    }
}

function dispatch(target: EventTarget, type: string, properties: Record<string, unknown>): void {
    const event = new Event(type);
    for (const [key, value] of Object.entries(properties)) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event);
}

test('every new playable ability activates once and advances cooldown only with simulation', () => {
    const characters: CharacterId[] = ['half-mutant', 'goliath', 'fanatic', 'nuclear', 'plasma-nuclear',
        'hunter', 'silver-hunter', 'telepath', 'cyborg', 'witcher'];
    for (const character of characters) withWorld(character, world => {
        assert.equal(world.activateAbility(), true, character);
        assert.equal(world.activateAbility(), false, character);
        const config = CHARACTER_ABILITIES[character]!;
        assert.equal(world.abilityState!.remainingCooldownMs, config.cooldownMs);
        world.update(0);
        assert.equal(world.abilityState!.remainingCooldownMs, config.cooldownMs);
        world.update(100);
        assert.equal(world.abilityState!.remainingCooldownMs, config.cooldownMs - 100);
        world.getPlayerController().getPlayer().currentHp = 0;
        world.update(100);
        assert.equal(world.abilityState!.remainingCooldownMs, config.cooldownMs - 100);
        assert.equal(world.activateAbility(), false);
    });
});

test('goliath ability kills enter real run statistics once', () => withWorld('goliath', (world, enemies) => {
    const controller = world.getPlayerController(), player = controller.getPlayer();
    const victim = new Enemy(player.x + 40, player.y);
    enemies.push(victim);
    assert.equal(world.activateAbility(), true);
    world.update(279);
    assert.equal(victim.isDead, false, 'damage waits for fists to strike the ground');
    world.update(1);
    assert.equal(victim.isDead, true);
    assert.equal(controller.getKillCount(), 1);
    world.update(16);
    assert.equal(controller.getKillCount(), 1);
}));

test('silver hunter invisibility preserves last known target and prevents contact, then expires', () => withWorld('silver-hunter', (world, enemies) => {
    const player = world.getPlayerController().getPlayer();
    const chaser = new Enemy(player.x + 400, player.y);
    enemies.push(chaser);
    assert.equal(world.activateAbility(), true);
    assert.equal(player.abilityInvisible, true);
    const before = [chaser.x, chaser.y];
    player.y += 150;
    world.update(16);
    assert.ok(chaser.x < before[0], 'enemies keep moving toward the last visible position');
    assert.equal(chaser.y, before[1], 'invisible movement cannot update the remembered target');
    const contact = new Enemy(player.x, player.y, EnemyType.BOSS);
    // Keep boss health, but avoid its large body triggering all three traps.
    contact.radius = 15;
    enemies.push(contact);
    const hp = player.currentHp;
    world.update(16);
    assert.equal(player.currentHp, hp);
    enemies.splice(0, enemies.length);
    world.update(5000 - 32);
    assert.equal(player.abilityInvisible, false);
    assert.ok(world.abilityState!.remainingActiveMs > 0, 'traps outlast the concealment window');
    enemies.splice(0, enemies.length);
    enemies.push(chaser);
    world.update(16);
    assert.ok(chaser.y > before[1], 'chase retargets the current position when the player is visible');
}));

test('mutant transformation changes real movement and suppresses held fire until expiry', () => withWorld('half-mutant', world => {
    const controller = world.getPlayerController(), player = controller.getPlayer();
    dispatch(document, 'keydown', { code: 'KeyD' });
    dispatch(window, 'mousemove', { clientX: player.x + 300, clientY: player.y });
    dispatch(window, 'mousedown', { button: 0, target: new HTMLCanvasElement() });
    assert.equal(world.activateAbility(), true);
    assert.equal(player.abilityBlocksShooting, true);
    assert.ok(player.abilityMoveSpeed > 1);
    const startX = player.x;
    world.update(16);
    assert.ok(player.x - startX > player.speed);
    assert.equal(controller.getBullets().length, 0);
    world.update(world.abilityState!.remainingActiveMs);
    assert.equal(player.abilityBlocksShooting, false);
    assert.equal(player.abilityMoveSpeed, 1);
    const restoredX = player.x;
    world.update(16);
    assert.ok(Math.abs(player.x - restoredX - player.speed) < 1e-9);
    assert.ok(controller.getBullets().length > 0, 'held fire resumes after transformation');
}));

test('early trap detonation ends the active HUD without resetting cooldown', () => {
    for (const character of ['hunter', 'silver-hunter'] as const) withWorld(character, (world, enemies) => {
        const controller = world.getPlayerController(), player = controller.getPlayer();
        const placements = planPlasmaTraps(player, controller.getAimPosition(), player.angle);
        world.activateAbility();
        for (const point of placements) {
            const enemy = new Enemy(point.x, point.y);
            enemy.speed = 0;
            enemies.push(enemy);
        }
        for (let elapsed = 0; elapsed < 1000; elapsed += 20) world.update(20);
        assert.equal(world.abilityState!.remainingActiveMs, 0);
        assert.equal(world.abilityState!.remainingCooldownMs, 60000 - 1000);
        assert.equal(player.abilityInvisible, false);
    });
});
