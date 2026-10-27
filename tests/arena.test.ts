import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getArenaSize } from '../src/gameplay/Arena';
import { Pickup, type PickupKind } from '../src/gameplay/Pickups';
import { GameWorld } from '../src/systems/GameWorld';
import { Player } from '../src/entities/player/Player';
import { Enemy } from '../src/entities/enemy/Enemy';

import type { PlayerController } from '../src/systems/Player/PlayerController';

test('drops can occupy the HUD area and stay within the viewport after resize', () => {
    for (const kind of ['health', 'weapon', 'ammo', 'fireBlast'] as PickupKind[]) {
        let arena = getArenaSize(1458, 960);
        assert.equal(arena.height, 960);
        const drop = new Pickup(kind, 600, 950, 600, 900, 30, 1, arena);
        assert.ok(drop.y > 827, 'drop starts inside the formerly forbidden HUD strip');
        assert.ok(drop.y + drop.radius <= arena.height);
        for (let i = 0; i < 40; i++) {
            if (i === 10) arena = getArenaSize(700, 600);
            drop.update(20, arena);
            assert.ok(drop.y + drop.radius <= arena.height);
        }
    }
});

test('enemies can move under HUD and the entire HUD is drawn after world and player', () => {
    const previous = globalThis.window;
    globalThis.window = { innerWidth: 1458, innerHeight: 960 } as Window & typeof globalThis;
    try {
        const order: string[] = [];
        const player = new Player(500, 940);
        const controller = {
            getPlayer: () => player, update: () => {}, getBullets: () => [], cleanupBullets: () => {},
            registerKill: () => {}, isMoving: false,
            draw: () => order.push('player'), drawHUD: () => order.push('playerHUD'),
        } as unknown as PlayerController;
        const world = new GameWorld(controller);
        const state = world as unknown as { enemies: Enemy[]; uiRenderer: { draw: () => void } };
        const enemy = new Enemy(700, 930);
        enemy.draw = () => { order.push('enemy'); };
        state.enemies.push(enemy);
        state.uiRenderer.draw = () => { order.push('healthHUD'); };
        world.update(16);
        assert.ok(enemy.y > 827, 'no HUD boundary clamps enemies upward');
        const ctx = new Proxy({}, { get: (_target, property) =>
            property === 'createLinearGradient' || property === 'createRadialGradient'
                ? () => ({ addColorStop() {} }) : () => {} });
        world.draw(ctx as CanvasRenderingContext2D);
        assert.deepEqual(order, ['enemy', 'player', 'healthHUD', 'playerHUD']);
    } finally { globalThis.window = previous; }
});
