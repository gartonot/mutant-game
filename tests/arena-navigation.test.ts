import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArenaNavigation } from '../src/systems/spatial/ArenaNavigation';
import { resolveArenaObstacles, resolveArenaSolidPolygons } from '../src/gameplay/ArenaObstacles';

const rectangle = (x: number, y: number, width: number, height: number) =>
    [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];

test('crowd navigation routes around the closed side of a U and reaches the player through its opening', () => {
    const navigation = new ArenaNavigation();
    const solids = [rectangle(340, 240, 60, 400), rectangle(340, 240, 420, 60), rectangle(340, 580, 420, 60)];
    const barrels = [{ x: 820, y: 420, radius: 24 }];
    const body = { x: 240, y: 420, radius: 15 }, target = { x: 540, y: 420 };
    let wentAround = false;
    for (let tick = 0; tick < 1600 && Math.hypot(body.x - target.x, body.y - target.y) > 4; tick++) {
        const waypoint = navigation.getWaypoint(body, target, 1200, 900, solids, barrels);
        const dx = waypoint.x - body.x, dy = waypoint.y - body.y;
        const length = Math.hypot(dx, dy);
        const previous = { x: body.x, y: body.y };
        body.x += dx / (length || 1) * Math.min(4, length);
        body.y += dy / (length || 1) * Math.min(4, length);
        const intended = { x: body.x, y: body.y };
        resolveArenaSolidPolygons(body, solids, previous);
        resolveArenaObstacles(body, barrels, previous);
        assert.ok(Math.hypot(body.x - intended.x, body.y - intended.y) < 0.01, 'the planned route never enters collision geometry');
        if (body.x > 775) wentAround = true;
    }
    assert.ok(wentAround, `enemy passes the open right side instead of pressing into the left wall: ${JSON.stringify(body)}`);
    assert.ok(Math.hypot(body.x - target.x, body.y - target.y) < 5);
});

test('navigation avoids cutting between touching diagonal obstacles', () => {
    const navigation = new ArenaNavigation();
    const solids = [rectangle(360, 300, 160, 160), rectangle(520, 460, 160, 160)];
    const body = { x: 310, y: 530, radius: 20 }, target = { x: 740, y: 350 };
    const barrels: { x: number; y: number; radius: number }[] = [];
    for (let tick = 0; tick < 800 && Math.hypot(body.x - target.x, body.y - target.y) > 4; tick++) {
        const waypoint = navigation.getWaypoint(body, target, 1100, 900, solids, barrels);
        const dx = waypoint.x - body.x, dy = waypoint.y - body.y, length = Math.hypot(dx, dy);
        const previous = { x: body.x, y: body.y };
        body.x += dx / (length || 1) * Math.min(3, length); body.y += dy / (length || 1) * Math.min(3, length);
        const intended = { x: body.x, y: body.y };
        resolveArenaSolidPolygons(body, solids, previous);
        assert.ok(Math.hypot(body.x - intended.x, body.y - intended.y) < 0.01);
    }
    assert.ok(Math.hypot(body.x - target.x, body.y - target.y) < 5);
});

test('nearby targets in the same cell reuse the flow field while open lines pursue the exact target', () => {
    const navigation = new ArenaNavigation();
    const solids = [rectangle(400, 260, 120, 400)];
    const barrels: { x: number; y: number; radius: number }[] = [];
    const body = { x: 220, y: 420, radius: 15 };
    const first = navigation.getWaypoint(body, { x: 820, y: 420 }, 1200, 900, solids, barrels);
    const second = navigation.getWaypoint(body, { x: 825, y: 425 }, 1200, 900, solids, barrels);
    assert.deepEqual(second, first, 'target motion within the same cell preserves the route');
    const exact = { x: 270, y: 425 };
    assert.deepEqual(navigation.getWaypoint(body, exact, 1200, 900, solids, barrels), exact);
});
