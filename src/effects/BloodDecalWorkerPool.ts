import type { BloodDecalInput } from './BloodDecal';
import type { BloodRemainsTile } from './BloodRemains';

export interface PreparedBloodDecal {
    canvas: ImageBitmap;
    x: number;
    y: number;
    remains?: { canvas: ImageBitmap; tiles: BloodRemainsTile[] };
}

interface PendingDecal {
    resolve: (result: PreparedBloodDecal | null) => void;
    timeout: ReturnType<typeof setTimeout>;
}

interface DecalWorker {
    worker: Worker;
    pending: Map<number, PendingDecal>;
    failed: boolean;
}

const workers: DecalWorker[] = [];
let initialized = false;
let nextRequestId = 0;
const REQUEST_TIMEOUT_MS = 3000;

function disableWorker(entry: DecalWorker): void {
    if (entry.failed) return;
    entry.failed = true;
    entry.worker.terminate();
    for (const pending of entry.pending.values()) {
        clearTimeout(pending.timeout);
        pending.resolve(null);
    }
    entry.pending.clear();
}

/** Start the bounded worker pool while the game is preparing its other assets. */
export function warmBloodDecalWorkers(): void {
    if (initialized || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return;
    initialized = true;
    for (let i = 0; i < 2; i++) {
        try {
            const worker = new Worker(new URL('./blood-decal.worker.ts', import.meta.url), { type: 'module' });
            const entry: DecalWorker = { worker, pending: new Map(), failed: false };
            worker.onmessage = (event: MessageEvent<{ id: number; result: PreparedBloodDecal | null }>) => {
                const { id, result } = event.data;
                const pending = entry.pending.get(id);
                if (!pending) {
                    // A timed-out or otherwise abandoned result must not retain GPU storage.
                    result?.canvas.close();
                    result?.remains?.canvas.close();
                    return;
                }
                entry.pending.delete(id);
                clearTimeout(pending.timeout);
                pending.resolve(result);
            };
            worker.onerror = () => disableWorker(entry);
            worker.onmessageerror = () => disableWorker(entry);
            workers.push(entry);
        } catch {
            // The other worker may still be available (for example under a resource limit).
        }
    }
}

/** Each request keeps its unique mask and pigment seed; no source buffers are detached. */
export function prepareBloodDecal(input: BloodDecalInput): Promise<PreparedBloodDecal | null> {
    warmBloodDecalWorkers();
    const available = workers.filter(entry => !entry.failed);
    if (!available.length) return Promise.resolve(null);
    const entry = available.reduce((least, candidate) => candidate.pending.size < least.pending.size ? candidate : least);
    const id = ++nextRequestId;
    return new Promise(resolve => {
        const timeout = setTimeout(() => disableWorker(entry), REQUEST_TIMEOUT_MS);
        entry.pending.set(id, { resolve, timeout });
        try {
            // Structured cloning deliberately retains the main-thread particle contours.
            entry.worker.postMessage({ id, input });
        } catch {
            disableWorker(entry);
        }
    });
}
