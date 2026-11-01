import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArenaBackground } from '../src/rendering/ArenaBackground';
import { ARENA_CRATES, getArenaBarrels, getArenaSolidPolygons, getArenaSectors, getArenaBarricades, resolveArenaSolidPolygons } from '../src/gameplay/ArenaObstacles';

test('3x3 world repeats the same collision geometry in each terrain sector and leaves sector centers clear', () => {
    const width = 3840, height = 2160;
    const sectors = getArenaSectors(width, height, 3);
    const barrels = getArenaBarrels(width, height, 3);
    const polygons = getArenaSolidPolygons(width, height, 3);
    const localBarrels = getArenaBarrels(width / 3, height / 3);
    const localPolygons = getArenaSolidPolygons(width / 3, height / 3);
    assert.equal(sectors.length, 9);
    assert.equal(barrels.length, 63);
    assert.equal(polygons.length, 54 + getArenaBarricades(width, height, 3).length);
    for (let index = 0; index < sectors.length; index++) {
        const sector = sectors[index];
        localBarrels.forEach((barrel, i) => {
            assert.deepEqual(barrels[index * 7 + i], { x: barrel.x + sector.x, y: barrel.y + sector.y, radius: barrel.radius });
            assert.ok(Math.hypot(barrel.x - sector.width / 2, barrel.y - sector.height / 2) > barrel.radius + 30);
        });
        localPolygons.forEach((polygon, i) => polygon.forEach((point, j) => {
            assert.ok(Math.abs(polygons[index * 6 + i][j].x - point.x - sector.x) < 1e-8);
            assert.ok(Math.abs(polygons[index * 6 + i][j].y - point.y - sector.y) < 1e-8);
        }));
    }
});

test('the rotated metal crates stop both player-sized and enemy-sized bodies across a full movement sweep', () => {
    const width = 1280, height = 720;
    const [px, py, angle] = ARENA_CRATES[0];
    const x = px * width, y = py * height;
    const start = { x: x - Math.cos(angle) * 100, y: y - Math.sin(angle) * 100 };
    for (const radius of [16, 27]) {
        const body = { x: x + Math.cos(angle) * 100, y: y + Math.sin(angle) * 100, radius };
        resolveArenaSolidPolygons(body, getArenaSolidPolygons(width, height), start);
        const localX = (body.x - x) * Math.cos(angle) + (body.y - y) * Math.sin(angle);
        assert.ok(localX <= -32 - radius + 1e-6, 'the body must remain on the approach side of the crate');
        assert.ok(localX > -100, 'the body should advance until the crate edge');
    }
});

test('terrain caches one sector canvas and draws only sectors intersecting the camera', () => {
    const previous = globalThis.document;
    const created: { width: number; height: number }[] = [];
    const paint = new Proxy({}, { get: (_object, key) => key === 'createLinearGradient' || key === 'createRadialGradient'
        ? () => ({ addColorStop() {} }) : () => {} });
    globalThis.document = { createElement: () => {
        const canvas = { width: 0, height: 0, getContext: () => paint };
        created.push(canvas);
        return canvas;
    } } as unknown as Document;
    try {
        const calls: unknown[][] = [];
        const ctx = { drawImage: (...args: unknown[]) => calls.push(args) } as unknown as CanvasRenderingContext2D;
        const terrain = new ArenaBackground();
        terrain.draw(ctx, 3840, 2160, { x: 1300, y: 740, width: 1240, height: 680 }, 3);
        assert.equal(created.length, 1);
        assert.equal(created[0].width, 1280);
        assert.equal(created[0].height, 720);
        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0].slice(1), [1280, 720, 1280, 720]);
        terrain.draw(ctx, 3840, 2160, { x: 2200, y: 1000, width: 1240, height: 680 }, 3);
        assert.equal(created.length, 1, 'moving the camera must reuse the same tile');
        assert.equal(calls.length, 5, 'second view touches four terrain sectors');
    } finally { globalThis.document = previous; }
});
