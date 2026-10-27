import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Player } from '../src/entities/player/Player';
import { Enemy } from '../src/entities/enemy/Enemy';
import { PlayerMovementController } from '../src/systems/Player/PlayerMovementController';
import type { InputSystem } from '../src/systems/InputSystem';
import { resolvePlayerContact } from '../src/systems/spatial/playerContact';

test('player can walk under HUD and stops only at the viewport edge', () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const viewport = { innerWidth: 1458, innerHeight: 960 };
    Object.defineProperty(globalThis, 'window', { value: viewport, configurable: true });
    try {
        const player = new Player(200, 800);
        const keys = new Set(['KeyS', 'KeyD']);
        const input = { isPressed: (key: string) => keys.has(key) } as InputSystem;
        const movement = new PlayerMovementController(player, input);
        for (let i = 0; i < 30; i++) movement.update();
        assert.equal(player.y + player.radius, 960);
        assert.equal(player.x, 350);
        // Resizing while idle keeps the player inside the viewport.
        keys.clear(); viewport.innerWidth = 700; viewport.innerHeight = 600;
        movement.update();
        assert.equal(player.y + player.radius, 600);
        keys.add('KeyW'); movement.update();
        assert.ok(player.y + player.radius < 600);
    } finally {
        if (previous) Object.defineProperty(globalThis, 'window', previous);
        else Reflect.deleteProperty(globalThis, 'window');
    }
});

test('enemy contact can push the player under HUD but not beyond the viewport', () => {
    for (const moving of [false, true]) {
        const player = new Player(500, 807);
        const enemy = new Enemy(500, 797);
        resolvePlayerContact(player, enemy, moving, 0, 1458, 960);
        assert.ok(player.y + player.radius > 827);
        player.y = 940; enemy.y = 930;
        resolvePlayerContact(player, enemy, moving, 0, 1458, 960);
        assert.equal(player.y + player.radius, 960);
    }
});
