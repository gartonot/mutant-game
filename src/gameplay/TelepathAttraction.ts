import type { Pickup } from './Pickups';

/** One uninterrupted hover charges one landed bonus; launched bonuses keep homing. */
export class TelepathAttraction {
    private target: Pickup | null = null;
    private elapsedMs = 0;

    update(deltaMs: number, pickups: readonly Pickup[], aim: { x: number; y: number }, enabled: boolean): void {
        const target = enabled ? pickups.find(item => !item.expired && !item.inFlight && !item.attracted
            && item.kind !== 'weapon' && Math.hypot(aim.x - item.x, aim.y - item.y) <= item.radius) ?? null : null;
        if (target !== this.target) {
            if (this.target) this.target.attractionProgress = 0;
            this.target = target;
            this.elapsedMs = 0;
        }
        if (!target) return;
        this.elapsedMs += Math.max(0, deltaMs);
        target.attractionProgress = Math.min(1, this.elapsedMs / 3000);
        if (this.elapsedMs >= 3000) {
            target.attracted = true;
            target.attractionProgress = 0;
            this.target = null;
            this.elapsedMs = 0;
        }
    }
}
