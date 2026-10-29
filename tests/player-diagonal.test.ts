import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Player } from '../src/entities/player/Player';
import { PlayerMovementController } from '../src/systems/Player/PlayerMovementController';
import type { InputSystem } from '../src/systems/InputSystem';

function withViewport(run: () => void): void {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
        value: { innerWidth: 2000, innerHeight: 2000 }, configurable: true,
    });
    try { run(); }
    finally {
        if (previous) Object.defineProperty(globalThis, 'window', previous);
        else Reflect.deleteProperty(globalThis, 'window');
    }
}

function move(keys: string[]) {
    const player = new Player(1000, 1000);
    const pressed = new Set(keys);
    const input = { isPressed: (key: string) => pressed.has(key) } as InputSystem;
    const controller = new PlayerMovementController(player, input);
    controller.update();
    return { dx: player.x - 1000, dy: player.y - 1000, moving: controller.moving };
}

test('all four diagonals travel exactly 50% farther than cardinal movement', () => withViewport(() => {
    const cardinal = move(['KeyD']).dx;
    for (const [horizontal, vertical, sx, sy] of [
        ['KeyD', 'KeyS', 1, 1], ['KeyD', 'KeyW', 1, -1],
        ['KeyA', 'KeyS', -1, 1], ['KeyA', 'KeyW', -1, -1],
    ] as const) {
        const result = move([horizontal, vertical]);
        assert.ok(Math.abs(Math.hypot(result.dx, result.dy) / cardinal - 1.5) < 1e-10);
        assert.equal(Math.sign(result.dx), sx);
        assert.equal(Math.sign(result.dy), sy);
        assert.equal(result.moving, true);
    }
}));

test('opposing inputs cancel without granting a diagonal speed boost', () => withViewport(() => {
    const cardinal = move(['KeyD']).dx;
    for (const key of ['KeyW', 'KeyS']) {
        const result = move(['KeyA', 'KeyD', key]);
        assert.equal(result.dx, 0);
        assert.equal(Math.abs(result.dy), cardinal);
    }
    for (const key of ['KeyA', 'KeyD']) {
        const result = move(['KeyW', 'KeyS', key]);
        assert.equal(result.dy, 0);
        assert.equal(Math.abs(result.dx), cardinal);
    }
    for (const keys of [[], ['KeyA', 'KeyD'], ['KeyW', 'KeyS'], ['KeyA', 'KeyD', 'KeyW', 'KeyS']]) {
        assert.deepEqual(move(keys), { dx: 0, dy: 0, moving: false });
    }
}));
