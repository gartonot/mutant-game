/** Optional bounded samples enabled by ?profile. */
export class FrameProfiler {
    private update = new Float64Array(600);
    private render = new Float64Array(600);
    private frame = new Float64Array(600);
    private index = 0;
    private count = 0;
    record(updateMs: number, renderMs: number, frameMs: number): void {
        this.update[this.index] = updateMs; this.render[this.index] = renderMs; this.frame[this.index] = frameMs;
        this.index = (this.index + 1) % this.update.length;
        this.count = Math.min(this.count + 1, this.update.length);
    }
    report() {
        const summarize = (samples: Float64Array) => {
            const values = Array.from(samples.subarray(0, this.count)).sort((a, b) => a - b);
            return { medianMs: values[Math.floor(values.length / 2)] ?? 0, p95Ms: values[Math.floor(values.length * .95)] ?? 0 };
        };
        return { samples: this.count, update: summarize(this.update), render: summarize(this.render), frameInterval: summarize(this.frame) };
    }
}
