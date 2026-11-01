import type { ArenaBarrel } from '@/gameplay/ArenaObstacles';
import { ARENA_BORDER } from '@/gameplay/Arena';

interface Point { x: number; y: number }
interface Body extends Point { radius: number }
type Polygon = readonly Point[];
interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
interface Field { radius: number; blocked: Uint8Array; distance: Int32Array; neighbors: Int32Array; goal: number }
const CELL = 40;
const OBSTACLE_CELL = 128;
const DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]] as const;

function pointSegmentSquared(point: Point, a: Point, b: Point): number {
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
    return (point.x - a.x - dx * t) ** 2 + (point.y - a.y - dy * t) ** 2;
}

function inside(point: Point, polygon: Polygon): boolean {
    let result = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[j], b = polygon[i];
        if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
    }
    return result;
}

function crossing(a: Point, b: Point, c: Point, d: Point): boolean {
    const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}

/** Shared reverse flow fields route the crowd around solid props, including concave groups. */
export class ArenaNavigation {
    private width = 0;
    private height = 0;
    private columns = 0;
    private rows = 0;
    private solids: readonly Polygon[] = [];
    private barrels: readonly ArenaBarrel[] = [];
    private bounds: Bounds[] = [];
    private readonly fields = new Map<number, Field>();
    private queue = new Int32Array(0);
    private obstacleColumns = 0;
    private obstacleRows = 0;
    private obstacleBuckets: number[][] = [];
    private candidateIds = new Int32Array(0);
    private candidateMarks = new Uint32Array(0);
    private queryMark = 0;
    private readonly lookahead = new Int32Array(7);

    getWaypoint(body: Body, target: Point, width: number, height: number,
        solids: readonly Polygon[], barrels: readonly ArenaBarrel[]): Point {
        if (width !== this.width || height !== this.height || solids !== this.solids || barrels !== this.barrels) {
            this.width = width; this.height = height;
            this.columns = Math.ceil(width / CELL); this.rows = Math.ceil(height / CELL);
            this.solids = solids; this.barrels = barrels;
            this.bounds = solids.map(polygon => ({ minX: Math.min(...polygon.map(p => p.x)), minY: Math.min(...polygon.map(p => p.y)),
                maxX: Math.max(...polygon.map(p => p.x)), maxY: Math.max(...polygon.map(p => p.y)) }));
            this.fields.clear();
            this.queue = new Int32Array(this.columns * this.rows);
            this.indexObstacles();
        }
        if (!this.columns || !this.rows || this.clearSegment(body, target, body.radius)) return target;
        const radius = Math.ceil(body.radius / 8) * 8;
        let field = this.fields.get(radius);
        if (!field) {
            if (this.fields.size >= 8) this.fields.delete(this.fields.keys().next().value!);
            field = this.createField(radius);
            this.fields.set(radius, field);
        }
        const targetCell = this.index(target);
        if (field.goal !== targetCell) this.buildDistances(field, targetCell);
        let current = this.index(body);
        if (field.blocked[current] || field.distance[current] < 0) {
            // Bodies can stand in a conservative grid's boundary cell while still being outside geometry.
            let best = Infinity;
            const cx = current % this.columns, cy = Math.floor(current / this.columns);
            current = -1;
            for (let y = Math.max(0, cy - 4); y <= Math.min(this.rows - 1, cy + 4); y++) {
                for (let x = Math.max(0, cx - 4); x <= Math.min(this.columns - 1, cx + 4); x++) {
                    const index = y * this.columns + x;
                    if (field.blocked[index] || field.distance[index] < 0) continue;
                    const point = this.center(index);
                    const score = Math.hypot(point.x - body.x, point.y - body.y);
                    if (score < best && this.clearSegment(body, point, body.radius)) { current = index; best = score; }
                }
            }
            if (current < 0) return { x: body.x, y: body.y };
        }
        let waypoint = this.center(current);
        // Test the furthest useful point first instead of casting seven overlapping rays.
        let lookaheadCount = 0;
        for (let i = 0; i < 7; i++) {
            const next = this.downhill(field, current);
            if (next === current) break;
            this.lookahead[lookaheadCount++] = next;
            current = next;
        }
        for (let i = lookaheadCount - 1; i >= 0; i--) {
            const point = this.center(this.lookahead[i]);
            if (!this.clearSegment(body, point, body.radius)) continue;
            waypoint = point;
            break;
        }
        return waypoint;
    }

    private index(point: Point): number {
        const x = Math.max(0, Math.min(this.columns - 1, Math.floor(point.x / CELL)));
        const y = Math.max(0, Math.min(this.rows - 1, Math.floor(point.y / CELL)));
        return y * this.columns + x;
    }

    private center(index: number): Point {
        return { x: Math.min(this.width, (index % this.columns + 0.5) * CELL),
            y: Math.min(this.height, (Math.floor(index / this.columns) + 0.5) * CELL) };
    }

    private createField(radius: number): Field {
        const size = this.columns * this.rows;
        const blocked = new Uint8Array(size);
        // Inflating by half a cell diagonal makes all points in a free cell safe for this body.
        const clearance = radius + CELL / Math.SQRT2;
        for (let index = 0; index < size; index++) {
            const point = this.center(index);
            if (point.x < ARENA_BORDER + clearance || point.x > this.width - ARENA_BORDER - clearance ||
                point.y < ARENA_BORDER + clearance || point.y > this.height - ARENA_BORDER - clearance) blocked[index] = 1;
        }
        // Rasterize each obstacle only into nearby cells; no world-wide geometry query per cell.
        const squared = clearance * clearance;
        for (let obstacle = 0; obstacle < this.solids.length + this.barrels.length; obstacle++) {
            const barrel = this.barrels[obstacle - this.solids.length];
            const polygon = this.solids[obstacle];
            const bounds = polygon ? this.bounds[obstacle] : {
                minX: barrel.x - barrel.radius, minY: barrel.y - barrel.radius,
                maxX: barrel.x + barrel.radius, maxY: barrel.y + barrel.radius,
            };
            const left = Math.max(0, Math.floor((bounds.minX - clearance) / CELL));
            const right = Math.min(this.columns - 1, Math.floor((bounds.maxX + clearance) / CELL));
            const top = Math.max(0, Math.floor((bounds.minY - clearance) / CELL));
            const bottom = Math.min(this.rows - 1, Math.floor((bounds.maxY + clearance) / CELL));
            for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
                const index = y * this.columns + x;
                if (blocked[index]) continue;
                const point = this.center(index);
                if (!polygon) {
                    if ((point.x - barrel.x) ** 2 + (point.y - barrel.y) ** 2 < (clearance + barrel.radius) ** 2) blocked[index] = 1;
                    continue;
                }
                if (inside(point, polygon)) { blocked[index] = 1; continue; }
                for (let p = 0, q = polygon.length - 1; p < polygon.length; q = p++) {
                    if (pointSegmentSquared(point, polygon[q], polygon[p]) < squared) { blocked[index] = 1; break; }
                }
            }
        }
        // Static connectivity is shared by every search for this body radius.
        const neighbors = new Int32Array(size * 8); neighbors.fill(-1);
        for (let index = 0; index < size; index++) {
            if (blocked[index]) continue;
            const x = index % this.columns, y = Math.floor(index / this.columns);
            for (let direction = 0; direction < DIRECTIONS.length; direction++) {
                const [dx, dy] = DIRECTIONS[direction], nx = x + dx, ny = y + dy;
                if (nx < 0 || nx >= this.columns || ny < 0 || ny >= this.rows) continue;
                const next = ny * this.columns + nx;
                if (blocked[next] || (dx && dy && (blocked[y * this.columns + nx] || blocked[ny * this.columns + x]))) continue;
                neighbors[index * 8 + direction] = next;
            }
        }
        return { radius, blocked, distance: new Int32Array(size), neighbors, goal: -1 };
    }

    private buildDistances(field: Field, targetCell: number): void {
        field.goal = targetCell; field.distance.fill(-1);
        let root = targetCell;
        if (field.blocked[root]) {
            let best = Infinity;
            const target = this.center(targetCell);
            for (let i = 0; i < field.blocked.length; i++) if (!field.blocked[i]) {
                const point = this.center(i);
                const score = (point.x - target.x) ** 2 + (point.y - target.y) ** 2;
                if (score < best) { best = score; root = i; }
            }
            if (best === Infinity) return;
        }
        let head = 0, tail = 0;
        this.queue[tail++] = root; field.distance[root] = 0;
        while (head < tail) {
            const index = this.queue[head++];
            for (let direction = 0; direction < 8; direction++) {
                const next = field.neighbors[index * 8 + direction];
                if (next < 0 || field.distance[next] >= 0) continue;
                field.distance[next] = field.distance[index] + 1;
                this.queue[tail++] = next;
            }
        }
    }

    private downhill(field: Field, index: number): number {
        let best = index;
        for (let direction = 0; direction < 8; direction++) {
            const next = field.neighbors[index * 8 + direction];
            if (next >= 0 && field.distance[next] >= 0 && field.distance[next] < field.distance[best]) best = next;
        }
        return best;
    }

    private indexObstacles(): void {
        this.obstacleColumns = Math.max(1, Math.ceil(this.width / OBSTACLE_CELL));
        this.obstacleRows = Math.max(1, Math.ceil(this.height / OBSTACLE_CELL));
        this.obstacleBuckets = Array.from({ length: this.obstacleColumns * this.obstacleRows }, () => []);
        const count = this.solids.length + this.barrels.length;
        this.candidateIds = new Int32Array(count);
        this.candidateMarks = new Uint32Array(count);
        this.queryMark = 0;
        for (let id = 0; id < count; id++) {
            const barrel = this.barrels[id - this.solids.length];
            const bounds = id < this.solids.length ? this.bounds[id] : {
                minX: barrel.x - barrel.radius, minY: barrel.y - barrel.radius,
                maxX: barrel.x + barrel.radius, maxY: barrel.y + barrel.radius,
            };
            const left = Math.max(0, Math.floor(bounds.minX / OBSTACLE_CELL));
            const right = Math.min(this.obstacleColumns - 1, Math.floor(bounds.maxX / OBSTACLE_CELL));
            const top = Math.max(0, Math.floor(bounds.minY / OBSTACLE_CELL));
            const bottom = Math.min(this.obstacleRows - 1, Math.floor(bounds.maxY / OBSTACLE_CELL));
            for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
                this.obstacleBuckets[y * this.obstacleColumns + x].push(id);
            }
        }
    }

    /** Visit only buckets touched by the swept body's capsule, without per-query allocations. */
    private collectCandidates(a: Point, b: Point, radius: number): number {
        this.queryMark = (this.queryMark + 1) >>> 0;
        if (!this.queryMark) { this.candidateMarks.fill(0); this.queryMark = 1; }
        const dx = b.x - a.x, dy = b.y - a.y;
        const stepX = Math.sign(dx), stepY = Math.sign(dy);
        let x = Math.floor(a.x / OBSTACLE_CELL), y = Math.floor(a.y / OBSTACLE_CELL);
        const endX = Math.floor(b.x / OBSTACLE_CELL), endY = Math.floor(b.y / OBSTACLE_CELL);
        const deltaX = dx ? OBSTACLE_CELL / Math.abs(dx) : Infinity;
        const deltaY = dy ? OBSTACLE_CELL / Math.abs(dy) : Infinity;
        let edgeX = dx ? ((x + (stepX > 0 ? 1 : 0)) * OBSTACLE_CELL - a.x) / dx : Infinity;
        let edgeY = dy ? ((y + (stepY > 0 ? 1 : 0)) * OBSTACLE_CELL - a.y) / dy : Infinity;
        const padding = Math.ceil(radius / OBSTACLE_CELL);
        let count = 0;
        for (;;) {
            const left = Math.max(0, x - padding), right = Math.min(this.obstacleColumns - 1, x + padding);
            const top = Math.max(0, y - padding), bottom = Math.min(this.obstacleRows - 1, y + padding);
            for (let by = top; by <= bottom; by++) for (let bx = left; bx <= right; bx++) {
                const bucket = this.obstacleBuckets[by * this.obstacleColumns + bx];
                for (let i = 0; i < bucket.length; i++) {
                    const id = bucket[i];
                    if (this.candidateMarks[id] === this.queryMark) continue;
                    this.candidateMarks[id] = this.queryMark;
                    this.candidateIds[count++] = id;
                }
            }
            if (x === endX && y === endY) break;
            if (edgeX < edgeY) { x += stepX; edgeX += deltaX; }
            else { y += stepY; edgeY += deltaY; }
        }
        return count;
    }

    private clearSegment(a: Point, b: Point, radius: number): boolean {
        const minX = Math.min(a.x, b.x) - radius, maxX = Math.max(a.x, b.x) + radius;
        const minY = Math.min(a.y, b.y) - radius, maxY = Math.max(a.y, b.y) + radius;
        const squared = radius * radius;
        const count = this.collectCandidates(a, b, radius);
        for (let candidate = 0; candidate < count; candidate++) {
            const id = this.candidateIds[candidate];
            if (id < this.solids.length) continue;
            const barrel = this.barrels[id - this.solids.length];
            if (barrel.x + barrel.radius < minX || barrel.x - barrel.radius > maxX ||
                barrel.y + barrel.radius < minY || barrel.y - barrel.radius > maxY) continue;
            if (pointSegmentSquared(barrel, a, b) < (radius + barrel.radius) ** 2) return false;
        }
        for (let candidate = 0; candidate < count; candidate++) {
            const i = this.candidateIds[candidate];
            if (i >= this.solids.length) continue;
            const bounds = this.bounds[i];
            if (bounds.maxX < minX || bounds.minX > maxX || bounds.maxY < minY || bounds.minY > maxY) continue;
            const polygon = this.solids[i];
            if (inside(a, polygon) || inside(b, polygon)) return false;
            for (let p = 0, q = polygon.length - 1; p < polygon.length; q = p++) {
                const c = polygon[q], d = polygon[p];
                if (crossing(a, b, c, d) || pointSegmentSquared(a, c, d) < squared || pointSegmentSquared(b, c, d) < squared ||
                    pointSegmentSquared(c, a, b) < squared || pointSegmentSquared(d, a, b) < squared) return false;
            }
        }
        return true;
    }
}
