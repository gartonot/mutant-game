import type { AmmoDefinition } from './weapons';

/** Mutable state belongs to a single weapon instance, never to the catalog. */
export class WeaponState {
    private remaining: number;
    private lastShot = -Infinity;
    private interval = 0;
    constructor(private readonly ammo: AmmoDefinition, readonly shotIntervalMs: number) {
        if (!Number.isFinite(shotIntervalMs) || shotIntervalMs <= 0) throw new Error('Invalid shot interval');
        if (ammo.kind === 'finite' && (!Number.isInteger(ammo.initial) || !Number.isInteger(ammo.capacity) ||
            !Number.isInteger(ammo.perShot) || ammo.initial < 0 || ammo.capacity < ammo.initial ||
            ammo.perShot < 1 || ammo.perShot > ammo.capacity)) throw new Error('Invalid ammo definition');
        this.remaining = ammo.kind === 'infinite' ? Infinity : ammo.initial;
    }
    get ammoRemaining(): number { return this.remaining; }
    canShoot(now: number): boolean {
        return Number.isFinite(now) && this.remaining >= (this.ammo.kind === 'finite' ? this.ammo.perShot : 1) &&
            now - this.lastShot >= this.interval;
    }
    consumeShot(now: number, interval = this.shotIntervalMs): boolean {
        if (!Number.isFinite(interval) || interval <= 0) throw new Error('Invalid shot interval');
        if (!this.canShoot(now)) return false;
        if (this.ammo.kind === 'finite') this.remaining -= this.ammo.perShot;
        this.lastShot = now;
        this.interval = interval;
        return true;
    }
    delay(now: number): void {
        if (!Number.isFinite(now)) throw new Error('Invalid weapon time');
        this.lastShot = now; this.interval = this.shotIntervalMs;
    }
    addAmmo(amount: number): void {
        if (!Number.isInteger(amount) || amount < 0) throw new Error('Invalid ammo pickup');
        if (this.ammo.kind === 'finite') this.remaining = Math.min(this.ammo.capacity, this.remaining + amount);
    }
    cooldownProgress(now: number): number {
        return Math.max(0, Math.min(1, (now - this.lastShot) / (this.interval || this.shotIntervalMs)));
    }
}
