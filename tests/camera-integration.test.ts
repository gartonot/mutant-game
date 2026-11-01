import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameWorld } from '../src/GameRuntime';
import { configureArena, getArenaSize, getCameraPosition, getRenderCameraPosition, resetArena, updateArenaCamera } from '../src/gameplay/Arena';
import type { GameWorld } from '../src/systems/GameWorld';
import { Enemy } from '../src/entities/enemy/Enemy';
import { Pickup } from '../src/gameplay/Pickups';

function withWorld(run: (world: GameWorld, win: EventTarget) => void): void {
    const previous = ['window', 'document', 'HTMLCanvasElement'].map(key =>
        [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
    class Canvas {}
    const win = Object.assign(new EventTarget(), { innerWidth: 1200, innerHeight: 800 });
    const doc = Object.assign(new EventTarget(), { hidden: false,
        createElement: () => ({ width: 1200, height: 800, getContext: () => recordingContext().ctx }) });
    for (const [key, value] of Object.entries({ window: win, document: doc, HTMLCanvasElement: Canvas })) {
        Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    let world: GameWorld | undefined;
    try { world = createGameWorld(); run(world, win); }
    finally {
        world?.dispose(); world?.getPlayerController().dispose(); resetArena();
        for (const [key, descriptor] of previous) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    }
}

function recordingContext() {
    let x = 0, y = 0;
    const stack: { x: number; y: number }[] = [];
    const arcs: { x: number; y: number; radius: number }[] = [];
    const implementations: Record<string, unknown> = {
        save: () => stack.push({ x, y }),
        restore: () => { const saved = stack.pop(); assert.ok(saved, 'unbalanced canvas restore'); ({ x, y } = saved); },
        translate: (dx: number, dy: number) => { x += dx; y += dy; },
        arc: (ax: number, ay: number, radius: number) => arcs.push({ x: ax + x, y: ay + y, radius }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
        measureText: () => ({ width: 30 }),
        globalAlpha: 1,
    };
    const ctx = new Proxy(implementations, { get: (target, key) => target[String(key)] ?? (() => {}) }) as unknown as CanvasRenderingContext2D;
    return { ctx, arcs, translation: () => ({ x, y }), depth: () => stack.length };
}

function moveMouse(win: EventTarget, x: number, y: number) {
    const event = new Event('mousemove');
    Object.defineProperties(event, { clientX: { value: x }, clientY: { value: y } });
    win.dispatchEvent(event);
}

test('runtime spawns at the center of the fixed world and camera centers that spawn on screen', () => withWorld(world => {
    const player = world.getPlayerController().getPlayer();
    assert.deepEqual(getArenaSize(), { width: 3600, height: 2400 });
    assert.equal(player.x, 1800); assert.equal(player.y, 1200);
    const camera = getCameraPosition(player);
    assert.equal(player.x - camera.x, 600); assert.equal(player.y - camera.y, 400);
}));

test('controller aim uses world coordinates while its HUD cursor stays at the screen mouse position', () => withWorld((world, win) => {
    const controller = world.getPlayerController(), player = controller.getPlayer();
    configureArena(1200, 800);
    player.x = 1800; player.y = 1200;
    moveMouse(win, 800, 300);
    assert.deepEqual(controller.getAimPosition(), { x: 2000, y: 1100 });
    controller.update(1000 / 60);
    assert.ok(Math.abs(player.angle - Math.atan2(-100, 200)) < 1e-9);
    const drawing = recordingContext();
    controller.drawHUD(drawing.ctx);
    assert.ok(drawing.arcs.some(arc => arc.radius === 10 && arc.x === 800 && arc.y === 300));
    assert.equal(drawing.depth(), 0);
    player.x += 200;
    updateArenaCamera(player, 16);
    const followed = getRenderCameraPosition(player);
    assert.ok(followed.x < getCameraPosition(player).x, 'camera should still be following the moving player');
    assert.deepEqual(controller.getAimPosition(), { x: 800 + followed.x, y: 300 + followed.y });
}));

test('world draw applies camera translation to world objects and restores it before every HUD layer', () => withWorld(world => {
    const controller = world.getPlayerController(), player = controller.getPlayer();
    player.x = 1800; player.y = 1200;
    const drawing = recordingContext();
    const calls: { kind: string; translation: { x: number; y: number } }[] = [];
    controller.draw = () => calls.push({ kind: 'world', translation: drawing.translation() });
    controller.drawHUD = () => calls.push({ kind: 'controller HUD', translation: drawing.translation() });
    const internal = world as unknown as {
        background: { draw: () => void };
        uiRenderer: { draw: () => void };
        bossEncounter: { drawHUD: () => void };
    };
    internal.background.draw = () => {};
    internal.uiRenderer.draw = () => calls.push({ kind: 'health HUD', translation: drawing.translation() });
    internal.bossEncounter.drawHUD = () => calls.push({ kind: 'boss HUD', translation: drawing.translation() });
    world.draw(drawing.ctx);
    assert.deepEqual(calls, [
        { kind: 'world', translation: { x: -1200, y: -800 } },
        { kind: 'health HUD', translation: { x: 0, y: 0 } },
        { kind: 'controller HUD', translation: { x: 0, y: 0 } },
        { kind: 'boss HUD', translation: { x: 0, y: 0 } },
    ]);
    assert.equal(drawing.depth(), 0);
}));

test('offscreen enemies and pickups keep simulating while artwork touching the camera edge remains visible', () => withWorld(world => {
    const state = world as unknown as { enemies: Enemy[]; pickups: Pickup[] };
    const calls: string[] = [];
    const on = new Enemy(1800, 1200), off = new Enemy(300, 300);
    const edge = new Enemy(1170, 1200);
    const lifted = new Enemy(1800, 1800); lifted.visualLift = 300;
    on.draw = () => calls.push('on'); off.draw = () => calls.push('off');
    edge.draw = () => calls.push('edge'); lifted.draw = () => calls.push('lifted');
    state.enemies.push(on, off, edge, lifted);
    const pickup = new Pickup('health', 300, 300, 300, 300, 20);
    pickup.draw = () => calls.push('off pickup'); state.pickups.push(pickup);
    const before = { x: off.x, y: off.y };
    world.update(16);
    assert.ok(off.x !== before.x || off.y !== before.y, 'offscreen enemies still pursue the player');
    lifted.visualLift = 300;
    world.draw(recordingContext().ctx);
    assert.ok(calls.includes('on'));
    assert.ok(calls.includes('edge'), 'arms and artwork outside the body circle must not pop at the edge');
    assert.ok(calls.includes('lifted'), 'jumping artwork can be visible even with an offscreen body');
    assert.ok(!calls.includes('off'));
    assert.ok(!calls.includes('off pickup'));
}));
