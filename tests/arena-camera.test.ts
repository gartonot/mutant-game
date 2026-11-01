import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARENA_BORDER, configureArena, getArenaGeneration, getArenaSectorSize, getArenaSize, getCameraPosition, getRenderCameraPosition, getVisibleArena, isArenaConfigured, resetArena, updateArenaCamera } from '../src/gameplay/Arena';

function withViewport(run: (viewport: { innerWidth: number; innerHeight: number }) => void) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const viewport = { innerWidth: 1200, innerHeight: 800 };
    Object.defineProperty(globalThis, 'window', { value: viewport, configurable: true });
    resetArena();
    try { run(viewport); }
    finally {
        resetArena();
        if (previous) Object.defineProperty(globalThis, 'window', previous);
        else Reflect.deleteProperty(globalThis, 'window');
    }
}

test('configured arena snapshots three screens and keeps its size after viewport resize', () => withViewport(viewport => {
    configureArena(1200, 800);
    assert.equal(isArenaConfigured(), true);
    assert.deepEqual(getArenaSectorSize(), { width: 1200, height: 800 });
    assert.deepEqual(getArenaSize(), { width: 3600, height: 2400 });
    viewport.innerWidth = 600; viewport.innerHeight = 500;
    assert.deepEqual(getArenaSectorSize(), { width: 1200, height: 800 });
    assert.deepEqual(getArenaSize(), { width: 3600, height: 2400 });
    assert.deepEqual(getArenaSize(640, 480), { width: 640, height: 480 });
    assert.deepEqual(getArenaSize(640), { width: 640, height: 500 });
    resetArena();
    assert.equal(isArenaConfigured(), false);
    assert.deepEqual(getArenaSectorSize(), { width: 600, height: 500 });
    assert.deepEqual(getArenaSize(), { width: 600, height: 500 });
}));

test('camera centers the player away from edges and clamps to all world corners', () => withViewport(() => {
    configureArena(1200, 800);
    assert.deepEqual(getCameraPosition({ x: 1800, y: 1200 }), { x: 1200, y: 800 });
    assert.deepEqual(getCameraPosition({ x: ARENA_BORDER, y: ARENA_BORDER }), { x: 0, y: 0 });
    assert.deepEqual(getCameraPosition({ x: 3600 - ARENA_BORDER, y: 2400 - ARENA_BORDER }), { x: 2400, y: 1600 });
    assert.deepEqual(getCameraPosition({ x: -100, y: 5000 }), { x: 0, y: 1600 });
    assert.deepEqual(getCameraPosition({ x: 1800, y: 1200 }, 600, 400), { x: 1500, y: 1000 });
}));

test('visible arena uses camera world coordinates and adapts to resized viewports', () => withViewport(viewport => {
    configureArena(1200, 800);
    const player = { x: 1800, y: 1200 };
    assert.deepEqual(getVisibleArena(player), { x: 1200, y: 800, width: 1200, height: 800 });
    viewport.innerWidth = 600; viewport.innerHeight = 400;
    assert.deepEqual(getVisibleArena(player), { x: 1200, y: 800, width: 600, height: 400 });
    viewport.innerWidth = 4000; viewport.innerHeight = 3000;
    assert.deepEqual(getVisibleArena(player), { x: 0, y: 0, width: 3600, height: 2400 });
}));

test('followed camera lags behind movement then settles without overshooting', () => withViewport(() => {
    configureArena(1200, 800);
    const player = { x: 2100, y: 1400 };
    assert.deepEqual(getRenderCameraPosition(player), { x: 1200, y: 800 });
    updateArenaCamera(player, 16);
    let camera = getRenderCameraPosition(player);
    assert.ok(camera.x > 1200 && camera.x < 1500);
    assert.ok(camera.y > 800 && camera.y < 1000);
    for (let i = 0; i < 180; i++) {
        const previous = camera;
        updateArenaCamera(player, 16);
        camera = getRenderCameraPosition(player);
        assert.ok(camera.x >= previous.x && camera.x <= 1500);
        assert.ok(camera.y >= previous.y && camera.y <= 1000);
    }
    assert.ok(Math.abs(camera.x - 1500) < 0.001);
    assert.ok(Math.abs(camera.y - 1000) < 0.001);
    assert.deepEqual(getVisibleArena(player), { ...camera, width: 1200, height: 800 });
}));

test('follow damping is frame-rate independent for a constant target', () => withViewport(() => {
    const player = { x: 2400, y: 1600 };
    configureArena(1200, 800);
    updateArenaCamera(player, 160);
    const singleStep = getRenderCameraPosition(player);
    configureArena(1200, 800);
    for (let i = 0; i < 10; i++) updateArenaCamera(player, 16);
    const smallSteps = getRenderCameraPosition(player);
    assert.ok(Math.abs(singleStep.x - smallSteps.x) < 1e-9);
    assert.ok(Math.abs(singleStep.y - smallSteps.y) < 1e-9);
}));

test('followed camera stays within resized world limits and reset discards its state', () => withViewport(viewport => {
    configureArena(1200, 800);
    const player = { x: 3500, y: 2300 };
    updateArenaCamera(player, 5000);
    let camera = getRenderCameraPosition(player);
    assert.ok(camera.x <= 2400 && camera.y <= 1600);
    viewport.innerWidth = 3000; viewport.innerHeight = 2200;
    camera = getRenderCameraPosition(player);
    assert.ok(camera.x <= 600 && camera.y <= 200);
    resetArena();
    updateArenaCamera(player, 1000);
    assert.deepEqual(getRenderCameraPosition(player), { x: 0, y: 0 });
}));

test('disposing an older arena generation cannot reset a newly configured run', () => withViewport(() => {
    configureArena(1200, 800);
    const oldGeneration = getArenaGeneration();
    configureArena(1000, 600);
    const newGeneration = getArenaGeneration();
    assert.ok(newGeneration > oldGeneration);
    resetArena(oldGeneration);
    assert.equal(getArenaGeneration(), newGeneration);
    assert.deepEqual(getArenaSize(), { width: 3000, height: 1800 });
    resetArena(newGeneration);
    assert.equal(isArenaConfigured(), false);
    assert.ok(getArenaGeneration() > newGeneration);
}));

test('standalone arena retains viewport dimensions and zero camera offset', () => withViewport(() => {
    assert.deepEqual(getArenaSize(), { width: 1200, height: 800 });
    assert.deepEqual(getCameraPosition({ x: 1000, y: 700 }), { x: 0, y: 0 });
    assert.deepEqual(getCameraPosition({ x: 1000, y: 700 }, 600, 400), { x: 0, y: 0 });
    assert.deepEqual(getVisibleArena({ x: 1000, y: 700 }), { x: 0, y: 0, width: 1200, height: 800 });
    const size = getArenaSize(); size.width = 1;
    assert.equal(getArenaSize().width, 1200);
}));
