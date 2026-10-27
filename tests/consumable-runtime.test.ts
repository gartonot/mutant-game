import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameWorld } from '../src/GameRuntime';
import { GameSession } from '../src/app/GameSession';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType } from '../src/entities/enemy/EnemyType';
import { defaultLoadout } from '../src/gameplay/characters';
import { Pickup } from '../src/gameplay/Pickups';
import { GOLD_PICKUP_KINDS } from '../src/gameplay/PickupVariants';
import { GameWorld } from '../src/systems/GameWorld';

function withBrowser(run: () => void): void {
    const previous = ['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
    const context = new Proxy({}, { get: (_target, key) => key === 'createRadialGradient'
        ? () => ({ addColorStop() {} }) : () => {} });
    const win = Object.assign(new EventTarget(), { innerWidth: 1200, innerHeight: 800 });
    const doc = Object.assign(new EventTarget(), { hidden: false,
        createElement: () => ({ width: 1200, height: 800, getContext: () => context }) });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
    try { run(); } finally {
        for (const [key, descriptor] of previous) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    }
}

type WorldInternals = { enemies: Enemy[]; pickups: Pickup[]; elapsed: number };
const internals = (world: GameWorld) => world as unknown as WorldInternals;
function state(world: GameWorld) {
    const player = world.getPlayerController().getPlayer();
    return { hp: player.currentHp, timers: player.activeBonuses, tiers: player.bonusTiers,
        damage: player.pickupDamageMultiplier, speed: player.pickupMoveSpeed, cadence: player.pickupAttackSpeed,
        enemies: internals(world).enemies.map(enemy => {
            const details = enemy as unknown as { health: number; slowMs: number; slowFactor: number };
            return { health: details.health, slowMs: details.slowMs, slowFactor: details.slowFactor };
        }) };
}

test('manual charges match actual floor pickups for every kind and both tiers', () => withBrowser(() => {
    for (const kind of GOLD_PICKUP_KINDS) for (const tier of ['silver', 'gold'] as const) {
        const base = defaultLoadout('mercenary');
        const manual = createGameWorld(undefined, 'mercenary', { ...base, consumables: [{ slotIndex: 2, kind, tier }] });
        const floor = createGameWorld(undefined, 'mercenary', base);
        try {
            for (const world of [manual, floor]) {
                const player = world.getPlayerController().getPlayer();
                player.maxHp = 200; player.currentHp = 20; player.bonusDuration = 1.5;
                internals(world).enemies = [100, 400].map(distance => {
                    const enemy = new Enemy(player.x + distance, player.y, EnemyType.BOSS);
                    enemy.speed = 0;
                    return enemy;
                });
            }
            const player = floor.getPlayerController().getPlayer();
            const pickup = new Pickup(kind, player.x, player.y, player.x, player.y, 0, 1,
                { width: 1200, height: 800 }, tier);
            pickup.update(400);
            internals(floor).pickups.push(pickup);
            floor.update(0);
            assert.equal(internals(floor).pickups.length, 0, `${kind}/${tier} was collected`);
            assert.equal(manual.activateConsumable(2), true);
            assert.deepEqual(state(manual), state(floor), `${kind}/${tier} activation parity`);
            if (kind === 'iceBlast' || kind === 'fireBlast') {
                assert.ok(state(manual).enemies[0].health < 20);
                assert.equal(state(manual).enemies[1].health, 20);
            }
            for (const world of [manual, floor]) world.getPlayerController().getPlayer().updatePickupHealing(400);
            assert.deepEqual(state(manual), state(floor), `${kind}/${tier} healing parity`);
            if (kind === 'health') assert.equal(state(manual).hp, tier === 'gold' ? 120 : 70);
            const after = state(manual);
            assert.equal(manual.activateConsumable(2), false);
            assert.deepEqual(state(manual), after, 'repeated activation has no effect');
        } finally {
            manual.getPlayerController().dispose(); floor.getPlayerController().dispose();
        }
    }
}));

test('empty and locked charges do nothing, used slots retain position and completed runs reject activation', () => withBrowser(() => {
    const world = createGameWorld(undefined, 'mercenary', { ...defaultLoadout('mercenary'), consumables: [
        { slotIndex: 1, kind: 'shield', tier: 'silver' }, { slotIndex: 3, kind: 'moveSpeed', tier: 'gold' },
    ] });
    try {
        const before = state(world);
        for (const index of [-1, 0, 2, 4, 5, 6, 1.5, NaN]) assert.equal(world.activateConsumable(index), false);
        assert.deepEqual(state(world), before);
        assert.equal(world.activateConsumable(1), true);
        assert.deepEqual(world.consumableSlots.map(entry => entry && [entry.kind, entry.used]),
            [null, ['shield', true], null, ['moveSpeed', false], null, null]);
        (world.consumableSlots[3] as { used: boolean }).used = true;
        assert.equal(world.consumableSlots[3]!.used, false, 'HUD snapshots cannot consume inventory');
        const player = world.getPlayerController().getPlayer();
        player.currentHp = 0;
        assert.equal(world.activateConsumable(3), false);
        player.currentHp = 100; internals(world).elapsed = GameWorld.DURATION_MS;
        assert.equal(world.activateConsumable(3), false);
        assert.equal(world.consumableSlots[3]!.used, false);
    } finally { world.getPlayerController().dispose(); }
}));

test('session resume retains spent bonuses while restart restores the original slot selection', () => withBrowser(() => {
    const loadout = { ...defaultLoadout('mercenary'), consumables: [{ slotIndex: 3, kind: 'shield' as const, tier: 'gold' as const }] };
    const session = new GameSession(selection => createGameWorld(undefined, selection.character, selection));
    try {
        const first = session.start(loadout);
        assert.equal(first.activateConsumable(3), true);
        session.pause(); session.resume();
        assert.equal(session.world, first);
        assert.equal(first.activateConsumable(3), false);
        session.showMenu(); assert.equal(session.start(loadout), first);
        loadout.consumables[0].slotIndex = 0;
        session.pause(); assert.equal(session.restart(), true);
        assert.notEqual(session.world, first);
        assert.equal(session.world!.consumableSlots[0], null);
        assert.equal(session.world!.consumableSlots[3]!.used, false);
        assert.equal(session.world!.activateConsumable(3), true);
    } finally { session.dispose(); }
}));
