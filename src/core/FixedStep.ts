export const STEP_MS = 1000 / 60;

/** Bounded catch-up: a suspended tab never starts a spiral of simulation work. */
export class FixedStep {
    private previous: number | undefined;
    private accumulator = 0;
    droppedMs = 0;
    constructor(readonly stepMs = STEP_MS, readonly maxSteps = 5) {
        if (!Number.isFinite(stepMs) || stepMs <= 0 || !Number.isInteger(maxSteps) || maxSteps < 1) {
            throw new Error('Invalid fixed-step configuration');
        }
    }
    reset(): void { this.previous = undefined; this.accumulator = 0; }
    advance(timestamp: number, update: (deltaMs: number) => void): number {
        if (this.previous === undefined) { this.previous = timestamp; return 0; }
        this.accumulator += Math.max(0, timestamp - this.previous);
        this.previous = timestamp;
        const budget = this.stepMs * this.maxSteps;
        if (this.accumulator > budget) {
            this.droppedMs += this.accumulator - budget;
            this.accumulator = budget;
        }
        let steps = 0;
        while (this.accumulator + 1e-8 >= this.stepMs && steps < this.maxSteps) {
            update(this.stepMs);
            this.accumulator -= this.stepMs;
            steps++;
        }
        return steps;
    }
}
