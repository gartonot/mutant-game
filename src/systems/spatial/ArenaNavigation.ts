import type { ArenaBarrel } from '@/gameplay/ArenaObstacles';
import { ARENA_BORDER } from '@/gameplay/Arena';

interface Point { x: number; y: number }
interface Body extends Point { radius: number }
type Polygon = readonly Point[];
interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
interface Field { radius: number; blocked: Uint8Array; distance: Int32Array; goal: number }
const CELL = 40;
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
        // Look ahead along the field only while the complete body has line of sight.
        for (let i = 0; i < 7; i++) {
            const next = this.downhill(field, current);
            if (next === current) break;
            const point = this.center(next);
            if (!this.clearSegment(body, point, body.radius)) break;
            waypoint = point; current = next;
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
                point.y < ARENA_BORDER + clearance || point.y > this.height - ARENA_BORDER - clearance ||
                !this.clearSegment(point, point, clearance)) blocked[index] = 1;
        }
        return { radius, blocked, distance: new Int32Array(size), goal: -1 };
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
            for (const next of this.neighbors(field, index)) {
                if (field.distance[next] >= 0) continue;
                field.distance[next] = field.distance[index] + 1;
                this.queue[tail++] = next;
            }
        }
    }

    private *neighbors(field: Field, index: number): Generator<number> {
        const x = index % this.columns, y = Math.floor(index / this.columns);
        for (const [dx, dy] of DIRECTIONS) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= this.columns || ny < 0 || ny >= this.rows) continue;
            const next = ny * this.columns + nx;
            if (field.blocked[next]) continue;
            if (dx && dy && (field.blocked[y * this.columns + nx] || field.blocked[ny * this.columns + x])) continue;
            yield next;
        }
    }

    private downhill(field: Field, index: number): number {
        let best = index;
        for (const next of this.neighbors(field, index)) if (field.distance[next] >= 0 && field.distance[next] < field.distance[best]) best = next;
        return best;
    }

    private clearSegment(a: Point, b: Point, radius: number): boolean {
        const minX = Math.min(a.x, b.x) - radius, maxX = Math.max(a.x, b.x) + radius;
        const minY = Math.min(a.y, b.y) - radius, maxY = Math.max(a.y, b.y) + radius;
        const squared = radius * radius;
        for (const barrel of this.barrels) {
            if (barrel.x + barrel.radius < minX || barrel.x - barrel.radius > maxX ||
                barrel.y + barrel.radius < minY || barrel.y - barrel.radius > maxY) continue;
            if (pointSegmentSquared(barrel, a, b) < (radius + barrel.radius) ** 2) return false;
        }
        for (let i = 0; i < this.solids.length; i++) {
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
