export interface ArenaBarrel { x: number; y: number; radius: number }
interface Body { x: number; y: number; radius: number }
interface Point { x: number; y: number }
const polygonBounds = new WeakMap<readonly Point[], { minX: number; minY: number; maxX: number; maxY: number }>();

export const ARENA_SLABS = [[0.14, 0.24, 0.12], [0.84, 0.7, -0.3], [0.2, 0.82, 0.4]] as const;
export const ARENA_STRIPED_BLOCK = [0.83, 0.46, -0.18] as const;
export const ARENA_SLAB_OUTLINE = [[-72, -43], [53, -43], [74, -25], [69, 42], [-47, 44], [-72, 26]] as const;
export const ARENA_CRATES = [[0.18, 0.42, -0.12], [0.68, 0.82, 0.18]] as const;
export const ARENA_CRATE_OUTLINE = [[-32, -29], [32, -29], [32, 29], [-32, 29]] as const;
export const ARENA_BARRELS = [[0.32, 0.34], [0.70, 0.38], [0.23, 0.57], [0.76, 0.72], [0.40, 0.78], [0.64, 0.19], [0.12, 0.68]] as const;
export interface ArenaBarricade {
    x: number; y: number; angle: number; width: number; height: number;
    material: 'concrete' | 'cargo'; polygon: Point[];
}
export interface ArenaCluster {
    x: number; y: number; angle: number; kind: 'pocket' | 'passage' | 'corner';
    opening: number; depth: number; walls: ArenaBarricade[];
}
let clusterKey = '';
let obstacleClusters: readonly ArenaCluster[] = [];

/** Runtime-only arrangements: gaps are measured in world pixels, never scaled below body clearance. */
export function getArenaObstacleClusters(width: number, height: number, count = 1): readonly ArenaCluster[] {
    const key = `${width}:${height}:${count}`;
    if (key === clusterKey) return obstacleClusters;
    clusterKey = key;
    if (count === 1) { obstacleClusters = []; return obstacleClusters; }
    const clusters: ArenaCluster[] = [];
    getArenaSectors(width, height, count).forEach((sector, index) => {
        // Tiny viewports retain the original props: a navigable pocket needs room for its entry.
        if (sector.width < 700 || sector.height < 480) return;
        const size = Math.min(1, sector.width / 1100, sector.height / 650);
        const thickness = 36;
        const add = (kind: ArenaCluster['kind'], px: number, py: number, angle: number,
            opening: number, depth: number, rectangles: readonly (readonly [number, number, number, number])[]) => {
            const x = sector.x + sector.width * px, y = sector.y + sector.height * py;
            const cos = Math.cos(angle), sin = Math.sin(angle);
            const walls = rectangles.map(([dx, dy, wallWidth, wallHeight], wallIndex): ArenaBarricade => {
                const cx = x + dx * cos - dy * sin, cy = y + dx * sin + dy * cos;
                const polygon = [[-wallWidth / 2, -wallHeight / 2], [wallWidth / 2, -wallHeight / 2],
                    [wallWidth / 2, wallHeight / 2], [-wallWidth / 2, wallHeight / 2]].map(([vx, vy]) => ({
                    x: cx + vx * cos - vy * sin, y: cy + vx * sin + vy * cos,
                }));
                return { x: cx, y: cy, angle, width: wallWidth, height: wallHeight,
                    material: (index + wallIndex) % 3 === 0 ? 'cargo' : 'concrete', polygon };
            });
            clusters.push({ x, y, angle, kind, opening, depth, walls });
        };
        const opening = Math.max(112, 140 * size);
        const depth = Math.max(140, 190 * size);
        const halfOuter = opening / 2 + thickness;
        add('pocket', 0.24, 0.33, (index % 3 - 1) * 0.09, opening, depth, [
            [-opening / 2 - thickness / 2, 0, thickness, depth],
            [opening / 2 + thickness / 2, 0, thickness, depth],
            [0, depth / 2 - thickness / 2, halfOuter * 2, thickness],
        ]);
        if (sector.width < 950 || sector.height < 620) return;
        const gap = 88;
        const length = 250 * size;
        add('passage', 0.72, 0.28, (index % 3 - 1) * -0.12, gap, length, [
            [0, -gap / 2 - thickness / 2, length, thickness],
            [0, gap / 2 + thickness / 2, length, thickness],
        ]);
        add('corner', 0.52, 0.81, (index % 4) * Math.PI / 2, 0, 180 * size, [
            [0, 0, 210 * size, thickness],
            [-105 * size + thickness / 2, -62 * size, thickness, 124 * size],
        ]);
    });
    obstacleClusters = clusters;
    return obstacleClusters;
}

export function getArenaBarricades(width: number, height: number, count = 1): readonly ArenaBarricade[] {
    return getArenaObstacleClusters(width, height, count).flatMap(cluster => cluster.walls);
}
export function getArenaSectors(width: number, height: number, count = 1) {
    const sectors: { x: number; y: number; width: number; height: number }[] = [];
    for (let row = 0; row < count; row++) for (let column = 0; column < count; column++) {
        sectors.push({ x: column * width / count, y: row * height / count, width: width / count, height: height / count });
    }
    return sectors;
}

let polygonWidth = -1, polygonHeight = -1, polygonSectors = -1;
let polygons: Point[][] = [];

export function getArenaSolidPolygons(width: number, height: number, count = 1): Point[][] {
    if (width === polygonWidth && height === polygonHeight && count === polygonSectors) return polygons;
    polygonWidth = width; polygonHeight = height; polygonSectors = count;
    polygons = [];
    for (const sector of getArenaSectors(width, height, count)) {
        const scale = Math.min(1, sector.width / 1000, sector.height / 650);
        const transform = ([x, y, angle]: readonly number[], points: readonly (readonly number[])[]) => points.map(([px, py]) => ({
            x: sector.x + x * sector.width + (px * Math.cos(angle) - py * Math.sin(angle)) * scale,
            y: sector.y + y * sector.height + (px * Math.sin(angle) + py * Math.cos(angle)) * scale,
        }));
        polygons.push(...ARENA_SLABS.map(placement => transform(placement, ARENA_SLAB_OUTLINE)));
        polygons.push(transform(ARENA_STRIPED_BLOCK, [[-68, -42], [68, -42], [68, 42], [-68, 42]]));
        polygons.push(...ARENA_CRATES.map(placement => transform(placement, ARENA_CRATE_OUTLINE)));
    }
    polygons.push(...getArenaBarricades(width, height, count).map(wall => wall.polygon));
    return polygons;
}

export function resolveArenaSolidPolygons(body: Body, solids: readonly (readonly Point[])[], previous?: Point): void {
    const targetX = body.x, targetY = body.y;
    const steps = previous ? Math.max(1, Math.ceil(Math.hypot(targetX - previous.x, targetY - previous.y) / Math.max(1, body.radius * 0.5))) : 1;
    const vx = previous ? (targetX - previous.x) / steps : 0;
    const vy = previous ? (targetY - previous.y) / steps : 0;
    if (previous) { body.x = previous.x; body.y = previous.y; }
    for (let step = 0; step < steps; step++) {
        body.x += vx; body.y += vy;
        for (let pass = 0; pass < 3; pass++) for (const polygon of solids) {
            let bounds = polygonBounds.get(polygon);
            if (!bounds) {
                bounds = { minX: Math.min(...polygon.map(p => p.x)), minY: Math.min(...polygon.map(p => p.y)),
                    maxX: Math.max(...polygon.map(p => p.x)), maxY: Math.max(...polygon.map(p => p.y)) };
                polygonBounds.set(polygon, bounds);
            }
            if (body.x + body.radius < bounds.minX || body.y + body.radius < bounds.minY ||
                body.x - body.radius > bounds.maxX || body.y - body.radius > bounds.maxY) continue;
            let inside = false, nearestX = 0, nearestY = 0, nearestSquared = Infinity;
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const a = polygon[j], b = polygon[i];
                if ((a.y > body.y) !== (b.y > body.y) && body.x < (b.x - a.x) * (body.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
                const ex = b.x - a.x, ey = b.y - a.y;
                const t = Math.max(0, Math.min(1, ((body.x - a.x) * ex + (body.y - a.y) * ey) / (ex * ex + ey * ey)));
                const x = a.x + ex * t, y = a.y + ey * t;
                const squared = (body.x - x) ** 2 + (body.y - y) ** 2;
                if (squared < nearestSquared) { nearestSquared = squared; nearestX = x; nearestY = y; }
            }
            const distance = Math.sqrt(nearestSquared);
            if (!inside && distance >= body.radius) continue;
            let nx = body.x - nearestX, ny = body.y - nearestY;
            if (inside) { nx = -nx; ny = -ny; }
            if (distance < 1e-8) {
                const centerX = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
                const centerY = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
                nx = nearestX - centerX; ny = nearestY - centerY;
            }
            const length = Math.hypot(nx, ny) || 1;
            body.x = nearestX + nx / length * (body.radius + 0.001);
            body.y = nearestY + ny / length * (body.radius + 0.001);
        }
    }
}
let cachedWidth = -1, cachedHeight = -1, cachedSectors = -1;
let barrels: readonly ArenaBarrel[] = [];

export function getArenaBarrels(width: number, height: number, count = 1): readonly ArenaBarrel[] {
    if (width !== cachedWidth || height !== cachedHeight || count !== cachedSectors) {
        cachedWidth = width; cachedHeight = height; cachedSectors = count;
        barrels = getArenaSectors(width, height, count).flatMap(sector => {
            const radius = Math.min(22, sector.width * 0.035, sector.height * 0.035);
            return sector.width < 260 || sector.height < 260 ? [] :
                ARENA_BARRELS
                    .map(([x, y]) => ({ x: sector.x + x * sector.width, y: sector.y + y * sector.height, radius }));
        });
    }
    return barrels;
}

/** Stop swept movement at the first impact, preserving the tangent for sliding. */
export function resolveArenaObstacles(body: Body, obstacles: readonly ArenaBarrel[], previous?: { x: number; y: number }): void {
    if (previous) {
        let startX = previous.x, startY = previous.y;
        let vx = body.x - startX, vy = body.y - startY;
        for (let pass = 0; pass < 4; pass++) {
            let first = 1;
            let hit: ArenaBarrel | undefined;
            const a = vx * vx + vy * vy;
            if (a < 1e-12) break;
            for (const obstacle of obstacles) {
                const dx = startX - obstacle.x, dy = startY - obstacle.y;
                const radius = body.radius + obstacle.radius;
                const b = dx * vx + dy * vy;
                const c = dx * dx + dy * dy - radius * radius;
                if (c < -1e-6 || b >= 0) continue;
                const discriminant = b * b - a * c;
                if (discriminant < 0) continue;
                const t = (-b - Math.sqrt(discriminant)) / a;
                if (t >= -1e-8 && t < first) { first = Math.max(0, t); hit = obstacle; }
            }
            if (!hit) { startX += vx; startY += vy; vx = 0; vy = 0; break; }
            startX += vx * first; startY += vy * first;
            const distance = Math.hypot(startX - hit.x, startY - hit.y) || 1;
            const nx = (startX - hit.x) / distance, ny = (startY - hit.y) / distance;
            vx *= 1 - first; vy *= 1 - first;
            const normal = Math.min(0, vx * nx + vy * ny);
            vx -= normal * nx; vy -= normal * ny;
            startX += nx * 0.001; startY += ny * 0.001;
        }
        body.x = startX; body.y = startY;
    }
    // Also recover from resize, spawn overlap and external displacement.
    for (let pass = 0; pass < 3; pass++) for (const obstacle of obstacles) {
        const dx = body.x - obstacle.x, dy = body.y - obstacle.y;
        const radius = body.radius + obstacle.radius;
        const distance = Math.hypot(dx, dy);
        if (distance >= radius) continue;
        body.x = obstacle.x + (distance > 0 ? dx / distance : 1) * (radius + 0.001);
        body.y = obstacle.y + (distance > 0 ? dy / distance : 0) * (radius + 0.001);
    }
}
