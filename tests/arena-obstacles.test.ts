import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getArenaBarrels, getArenaSolidPolygons, resolveArenaObstacles, resolveArenaSolidPolygons } from '../src/gameplay/ArenaObstacles';

const barrels = [{ x: 100, y: 100, radius: 20 }];
const outside = (body: { x: number; y: number; radius: number }) =>
    Math.hypot(body.x - 100, body.y - 100) >= body.radius + 20 - 1e-6;

test('barrels stop a body at its outer radius rather than its center', () => {
    const player = { x: 80, y: 100, radius: 10 };
    resolveArenaObstacles(player, barrels, { x: 60, y: 100 });
    assert.ok(outside(player));
    assert.ok(player.x <= 70 + 1e-5);
    assert.ok(Math.abs(player.y - 100) < 1e-5);
});

test('diagonal movement slides along the barrel instead of cancelling all motion', () => {
    const player = { x: 71, y: 105, radius: 10 };
    resolveArenaObstacles(player, barrels, { x: 69, y: 100 });
    assert.ok(outside(player));
    assert.ok(player.y > 100, 'tangential movement should survive contact');
    assert.ok(player.x < 100, 'contact must keep the player on the approach side');
});

test('a body exactly at a barrel center is separated without NaN coordinates', () => {
    const player = { x: 100, y: 100, radius: 10 };
    resolveArenaObstacles(player, barrels);
    assert.ok(Number.isFinite(player.x) && Number.isFinite(player.y));
    assert.ok(outside(player));
});

test('fast movement cannot tunnel through a barrel with both endpoints outside', () => {
    const player = { x: 160, y: 100, radius: 10 };
    resolveArenaObstacles(player, barrels, { x: 40, y: 100 });
    assert.ok(outside(player));
    assert.ok(player.x <= 70 + 1e-5, 'the swept path must stop on the near side');
});

test('barrel layouts resize safely and leave the central spawn clear', () => {
    for (const [width, height] of [[1280, 720], [1920, 1080], [383, 548]]) {
        const layout = getArenaBarrels(width, height);
        assert.ok(layout.length > 0);
        for (const barrel of layout) {
            assert.ok(barrel.x >= barrel.radius && barrel.x + barrel.radius <= width);
            assert.ok(barrel.y >= barrel.radius && barrel.y + barrel.radius <= height);
            assert.ok(Math.hypot(barrel.x - width / 2, barrel.y - height / 2) > barrel.radius + 25);
        }
    }
    const desktop = getArenaBarrels(1280, 720);
    const resized = getArenaBarrels(1920, 1080);
    assert.notEqual(desktop[0].x, resized[0].x);
    assert.equal(desktop[0].x, getArenaBarrels(1280, 720)[0].x);
});

const rectangle = [[{ x: 100, y: 50 }, { x: 140, y: 50 }, { x: 140, y: 150 }, { x: 100, y: 150 }]];

test('large movement cannot cross a solid polygon with endpoints outside', () => {
    const player = { x: 200, y: 100, radius: 10 };
    resolveArenaSolidPolygons(player, rectangle, { x: 40, y: 100 });
    assert.ok(player.x <= 90 + 1e-5);
    assert.ok(Math.abs(player.y - 100) < 1e-5);
});

test('polygon walls preserve movement parallel to the contacted edge', () => {
    const player = { x: 105, y: 115, radius: 10 };
    resolveArenaSolidPolygons(player, rectangle, { x: 85, y: 90 });
    assert.ok(player.x <= 90 + 1e-5);
    assert.ok(player.y > 90, 'contact must preserve some tangential motion');
});

test('a body initially inside a solid polygon is moved to its exterior', () => {
    const player = { x: 120, y: 100, radius: 10 };
    resolveArenaSolidPolygons(player, rectangle);
    assert.ok(Number.isFinite(player.x) && Number.isFinite(player.y));
    assert.ok(player.x <= 90 + 1e-5 || player.x >= 150 - 1e-5 || player.y <= 40 + 1e-5 || player.y >= 160 - 1e-5);
});

test('solid slab outlines match the visible rotated concrete slabs at each viewport', () => {
    const positions = [[0.14, 0.24, 0.12], [0.84, 0.7, -0.3], [0.2, 0.82, 0.4]];
    const vertices = [[-72, -43], [53, -43], [74, -25], [69, 42], [-47, 44], [-72, 26]];
    for (const [width, height] of [[1280, 720], [383, 548]]) {
        const polygons = getArenaSolidPolygons(width, height);
        const scale = Math.min(1, width / 1000, height / 650);
        assert.ok(polygons.length >= positions.length);
        positions.forEach(([x, y, angle], index) => {
            const polygon = polygons[index];
            assert.equal(polygon.length, vertices.length);
            vertices.forEach(([vx, vy], vertex) => {
                const expectedX = x * width + (vx * Math.cos(angle) - vy * Math.sin(angle)) * scale;
                const expectedY = y * height + (vx * Math.sin(angle) + vy * Math.cos(angle)) * scale;
                assert.ok(Math.abs(polygon[vertex].x - expectedX) < 1e-6);
                assert.ok(Math.abs(polygon[vertex].y - expectedY) < 1e-6);
            });
        });
    }
});
