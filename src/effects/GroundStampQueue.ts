interface GroundStampEntry {
    ready: boolean;
    disposed: boolean;
    value: unknown | null;
    draw: ((ctx: CanvasRenderingContext2D, value: unknown | null) => void) | null;
    release: (value: unknown) => void;
}

// Promise handlers retain only their entry. Disposing clears the drawing closure,
// so a late worker result cannot keep the old world alive or draw into a new run.
function settle(entry: GroundStampEntry, value: unknown | null): void {
    if (entry.disposed) {
        if (value !== null) entry.release(value);
        return;
    }
    entry.value = value;
    entry.ready = true;
}

function releaseEntry(entry: GroundStampEntry): void {
    entry.disposed = true;
    entry.draw = null;
    const value = entry.value;
    entry.value = null;
    if (value !== null) entry.release(value);
}

/** Keeps transparent ground stamps in event order while bounding frame work. */
export class GroundStampQueue {
    private entries: GroundStampEntry[] = [];
    private head = 0;
    private disposed = false;

    constructor(private readonly clock: () => number = () => performance.now()) {}

    get pendingCount(): number { return this.entries.length - this.head; }

    enqueue(draw: (ctx: CanvasRenderingContext2D) => void): void {
        if (this.disposed) return;
        this.entries.push({ ready: true, disposed: false, value: null, draw, release: () => {} });
    }

    enqueueAsync<T>(result: Promise<T | null>,
        draw: (ctx: CanvasRenderingContext2D, value: T | null) => void,
        release: (value: T) => void): void {
        const entry: GroundStampEntry = {
            ready: false, disposed: this.disposed, value: null,
            draw: this.disposed ? null : (ctx, value) => draw(ctx, value as T | null),
            release: value => release(value as T),
        };
        if (!this.disposed) this.entries.push(entry);
        result.then(value => settle(entry, value), () => settle(entry, null));
    }

    flush(ctx: CanvasRenderingContext2D, budgetMs = 4): void {
        if (this.disposed) return;
        const start = this.clock();
        const budget = Number.isFinite(budgetMs) ? Math.max(0, budgetMs) : 4;
        while (this.head < this.entries.length) {
            const entry = this.entries[this.head];
            if (!entry.ready) break;
            this.head++;
            try {
                entry.draw?.(ctx, entry.value);
            } finally {
                releaseEntry(entry);
            }
            // Always allow one ready stamp, even when the budget is zero.
            if (this.clock() - start >= budget) break;
        }
        if (this.head === this.entries.length) {
            this.entries = [];
            this.head = 0;
        } else if (this.head > 128 && this.head * 2 >= this.entries.length) {
            this.entries = this.entries.slice(this.head);
            this.head = 0;
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        for (let i = this.head; i < this.entries.length; i++) releaseEntry(this.entries[i]);
        this.entries = [];
        this.head = 0;
    }
}
