import { loadImageAsset } from '@/rendering/ImageAsset';
import type { ImageAsset } from '@/rendering/ImageAsset';

/** One low-priority request at a time, after the visible portrait and roster are ready. */
export class PortraitPreloader {
    private readonly assets = new Map<string, ImageAsset>();
    private generation = 0;
    private active = false;
    private disposed = false;

    constructor(private readonly urls: readonly string[], private readonly createImage = () => new Image()) {}

    prime(url: string): void { if (!this.disposed) this.ensure(url, 'high'); }
    isReady(url: string): boolean { return this.assets.get(url)?.loaded ?? false; }

    async prepareAll(concurrency = 3): Promise<boolean> {
        if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Invalid image concurrency');
        if (this.disposed) return false;
        let cursor = 0;
        const results: boolean[] = [];
        const worker = async () => {
            while (!this.disposed && cursor < this.urls.length) {
                const index = cursor++;
                results[index] = await this.ensure(this.urls[index], 'low').ready;
            }
        };
        await Promise.all(Array.from({ length: Math.min(concurrency, this.urls.length) }, worker));
        return !this.disposed && results.length === this.urls.length && results.every(Boolean);
    }

    select(url: string, rosterReady: Promise<unknown> = Promise.resolve(), background = true): Promise<boolean> {
        if (this.disposed) return Promise.resolve(false);
        this.active = true;
        const generation = ++this.generation;
        const selected = this.ensure(url, 'high');
        if (!background) return selected.ready;
        void Promise.all([selected.ready, rosterReady]).then(async ([ready]) => {
            if (!ready) return;
            for (const candidate of this.urls) {
                if (!this.active || this.disposed || generation !== this.generation) return;
                if (candidate !== url) await this.ensure(candidate, 'low').ready;
            }
        });
        return selected.ready;
    }

    pause(): void { this.active = false; ++this.generation; }

    dispose(): void {
        this.pause();
        this.disposed = true;
        this.assets.clear();
    }

    private ensure(url: string, priority: 'high' | 'low'): ImageAsset {
        const existing = this.assets.get(url);
        if (existing) {
            if (priority === 'high') existing.image.fetchPriority = 'high';
            return existing;
        }
        const asset = loadImageAsset(url, () => {
            const image = this.createImage();
            image.fetchPriority = priority;
            image.decoding = 'async';
            return image;
        });
        this.assets.set(url, asset);
        void asset.ready.then(success => {
            if (!success && this.assets.get(url) === asset) this.assets.delete(url);
        });
        return asset;
    }
}
