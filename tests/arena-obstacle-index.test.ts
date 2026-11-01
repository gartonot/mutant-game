import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveArenaObstacles, resolveArenaSolidPolygons } from '../src/gameplay/ArenaObstacles';

test('barrel recovery rechecks newly reached spatial cells after a large overlap correction', () => {
    const body = { x: 0, y: 0, radius: 10 };
    resolveArenaObstacles(body, [{ x: 0, y: 0, radius: 150 }, { x: 155, y: 0, radius: 30 }]);
    assert.ok(Math.abs(body.x - 195.001) < 1e-8);
    assert.equal(body.y, 0);
});

test('polygon recovery sees props outside its original cell after moving out of a large solid', () => {
    const rectangle = (left: number, right: number, top: number, bottom: number) =>
        [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
    const body = { x: 100, y: 0, radius: 10 };
    resolveArenaSolidPolygons(body, [rectangle(-400, 400, -500, 500), rectangle(390, 405, -30, 30)]);
    assert.ok(Math.abs(body.x - 415.001) < 1e-8);
    assert.equal(body.y, 0);
});

test('a swept barrel query spans every crossed cell and stops at the nearest contact regardless of list order', () => {
    const body = { x: 1200, y: 128, radius: 10 };
    const obstacles = [{ x: 900, y: 128, radius: 20 }, { x: 500, y: 128, radius: 20 },
        { x: 128, y: 900, radius: 20 }];
    resolveArenaObstacles(body, obstacles, { x: 0, y: 128 });
    assert.ok(Math.abs(body.x - 469.999) < 1e-8);
    assert.equal(body.y, 128);
});
