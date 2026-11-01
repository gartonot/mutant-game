import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getArenaObstacleClusters, getArenaSolidPolygons, getArenaBarrels, resolveArenaSolidPolygons, resolveArenaObstacles } from '../src/gameplay/ArenaObstacles';

test('all pocket entrances and narrow corridors admit players and ordinary enemies among the full prop layout', () => {
    for (const [sectorWidth, sectorHeight] of [[1280, 720], [1920, 1080]]) {
        const width = sectorWidth * 3, height = sectorHeight * 3;
        const polygons = getArenaSolidPolygons(width, height, 3), barrels = getArenaBarrels(width, height, 3);
        const clusters = getArenaObstacleClusters(width, height, 3);
        assert.equal(clusters.length, 27);
        for (const cluster of clusters) {
            if (cluster.kind === 'corner') continue;
            const cos = Math.cos(cluster.angle), sin = Math.sin(cluster.angle);
            const point = (x: number, y: number) => ({ x: cluster.x + x * cos - y * sin, y: cluster.y + x * sin + y * cos });
            const entry = cluster.kind === 'pocket' ? point(0, -cluster.depth / 2 - 50) : point(-cluster.depth / 2 - 40, 0);
            const target = cluster.kind === 'pocket' ? point(0, 0) : point(cluster.depth / 2 + 40, 0);
            for (const radius of [20, 27]) {
                const body = { ...target, radius };
                resolveArenaSolidPolygons(body, polygons, entry);
                resolveArenaObstacles(body, barrels, entry);
                assert.ok(Math.hypot(body.x - target.x, body.y - target.y) < 0.01,
                    `${cluster.kind} entrance at ${cluster.x},${cluster.y} is obstructed for radius ${radius}`);
                if (cluster.kind === 'pocket') {
                    body.x = entry.x; body.y = entry.y;
                    resolveArenaSolidPolygons(body, polygons, target);
                    resolveArenaObstacles(body, barrels, target);
                    assert.ok(Math.hypot(body.x - entry.x, body.y - entry.y) < 0.01, 'the same entrance remains a usable exit');
                }
            }
        }
    }
});

test('pockets have three impassable sides while the world spawn retains 100 pixels of clearance', () => {
    const width = 3840, height = 2160;
    const polygons = getArenaSolidPolygons(width, height, 3), barrels = getArenaBarrels(width, height, 3);
    const spawn = { x: width / 2, y: height / 2, radius: 100 };
    resolveArenaSolidPolygons(spawn, polygons);
    resolveArenaObstacles(spawn, barrels);
    assert.deepEqual(spawn, { x: width / 2, y: height / 2, radius: 100 });
    for (const cluster of getArenaObstacleClusters(width, height, 3)) {
        if (cluster.kind !== 'pocket') continue;
        const cos = Math.cos(cluster.angle), sin = Math.sin(cluster.angle);
        const point = (x: number, y: number) => ({ x: cluster.x + x * cos - y * sin, y: cluster.y + x * sin + y * cos });
        const start = point(0, 0);
        for (const [dx, dy] of [[-cluster.opening, 0], [cluster.opening, 0], [0, cluster.depth]]) {
            const target = point(dx, dy), body = { ...target, radius: 20 };
            resolveArenaSolidPolygons(body, cluster.walls.map(wall => wall.polygon), start);
            assert.ok(Math.hypot(body.x - target.x, body.y - target.y) > 30, 'side and back walls prevent a second exit');
        }
    }
});
