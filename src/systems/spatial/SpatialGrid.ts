export interface SpatialBody { x: number; y: number; radius: number }
interface Cell<T> { x: number; y: number; items: T[] }

/** One entry per center. Queries expand by maximum radius; negative cells are valid. */
export class SpatialGrid<T extends SpatialBody> {
    private rows = new Map<number, Map<number, Cell<T>>>();
    // Keep insertion order independently of the row index: collision tie-breaking
    // and simultaneous separation must not change when the index changes.
    private cells: Cell<T>[] = [];
    private pool: Cell<T>[] = [];
    private rowPool: Map<number, Cell<T>>[] = [];
    private locations = new Map<T, Cell<T>>();
    maxRadius = 0;
    constructor(readonly cellSize = 64) {
        if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error('Invalid cell size');
    }
    rebuild(items: readonly T[]): void {
        for (const cell of this.cells) { cell.items.length = 0; this.pool.push(cell); }
        for (const row of this.rows.values()) { row.clear(); this.rowPool.push(row); }
        this.cells.length = 0; this.rows.clear(); this.locations.clear(); this.maxRadius = 0;
        for (const item of items) this.insert(item);
    }
    private insert(item: T): void {
        const x = Math.floor(item.x / this.cellSize), y = Math.floor(item.y / this.cellSize);
        let row = this.rows.get(y);
        if (!row) { row = this.rowPool.pop() ?? new Map(); this.rows.set(y, row); }
        let cell = row.get(x);
        if (!cell) {
            cell = this.pool.pop() ?? { x, y, items: [] };
            cell.x = x; cell.y = y;
            row.set(x, cell); this.cells.push(cell);
        }
        cell.items.push(item); this.locations.set(item, cell);
        this.maxRadius = Math.max(this.maxRadius, item.radius);
    }
    /** Keep broad phase valid after immediate knockback. */
    relocate(item: T): void {
        const previous = this.locations.get(item);
        this.maxRadius = Math.max(this.maxRadius, item.radius);
        if (previous?.x === Math.floor(item.x / this.cellSize) && previous.y === Math.floor(item.y / this.cellSize)) return;
        if (previous !== undefined) {
            const bucket = previous.items;
            const index = bucket.indexOf(item);
            bucket[index] = bucket[bucket.length - 1]; bucket.pop();
        }
        this.insert(item);
    }
    /** Visit each potentially overlapping pair once, without per-body neighbor lists. */
    forEachPair(visit: (a: T, b: T) => void): void {
        const reach = Math.ceil(2 * this.maxRadius / this.cellSize);
        for (const { x: cx, y: cy, items: bucket } of this.cells) {
            for (let i = 0; i < bucket.length; i++) {
                for (let j = i + 1; j < bucket.length; j++) visit(bucket[i], bucket[j]);
            }
            for (let dy = 0; dy <= reach; dy++) {
                const row = this.rows.get(cy + dy);
                if (!row) continue;
                for (let dx = dy === 0 ? 1 : -reach; dx <= reach; dx++) {
                    const other = row.get(cx + dx)?.items;
                    if (!other) continue;
                    for (const a of bucket) for (const b of other) visit(a, b);
                }
            }
        }
    }
    query(minX: number, minY: number, maxX: number, maxY: number, result: T[]): void {
        result.length = 0;
        const radius = this.maxRadius;
        const x0 = Math.floor((minX - radius) / this.cellSize), x1 = Math.floor((maxX + radius) / this.cellSize);
        const y0 = Math.floor((minY - radius) / this.cellSize), y1 = Math.floor((maxY + radius) / this.cellSize);
        for (let y = y0; y <= y1; y++) {
            const row = this.rows.get(y);
            if (!row) continue;
            for (let x = x0; x <= x1; x++) {
                const bucket = row.get(x)?.items;
                if (bucket) for (const item of bucket) result.push(item);
            }
        }
    }
}
