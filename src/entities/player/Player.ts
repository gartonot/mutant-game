import type { CharacterId } from '@/gameplay/ids';
import type { WeaponId } from '@/gameplay/ids';
import type { PickupTier } from '@/gameplay/PickupVariants';

export type TemporaryBonus = 'rapidFire' | 'moveSpeed' | 'doubleDamage' | 'shield';

export class Player {
    x;
    y;
    speed = 5;
    radius = 20;
    character: CharacterId = 'mercenary';
    weapon: WeaponId = 'pistol';
    angle = 0;
    recoil = 0;

    // Здоровье игрока
    maxHp = 100;
    currentHp = 100;
    damageTaken = 0;
    damageReduction = 0;
    regeneration = 0;
    bonusGroundDuration = 1;
    bonusDuration = 1;
    private regenerationElapsed = 0;
    private pickupHealing: { remainingMs: number; hpPerMs: number }[] = [];
    private bonusTimers: Record<TemporaryBonus, number> = { rapidFire: 0, moveSpeed: 0, doubleDamage: 0, shield: 0 };
    private bonusDurations: Record<TemporaryBonus, number> = { rapidFire: 0, moveSpeed: 0, doubleDamage: 0, shield: 0 };
    private bonusPickupOrder: TemporaryBonus[] = [];
    private activeBonusTiers: Partial<Record<TemporaryBonus, PickupTier>> = {};

    get activeBonuses(): Readonly<Record<TemporaryBonus, number>> { return { ...this.bonusTimers }; }
    get bonusOrder(): readonly TemporaryBonus[] { return [...this.bonusPickupOrder]; }
    get bonusTiers(): Readonly<Partial<Record<TemporaryBonus, PickupTier>>> { return { ...this.activeBonusTiers }; }
    get pickupDamageMultiplier(): number { return this.bonusTimers.doubleDamage > 0 ? (this.activeBonusTiers.doubleDamage === 'gold' ? 4 : 2) : 1; }
    get pickupAttackSpeed(): number { return this.bonusTimers.rapidFire > 0 ? (this.activeBonusTiers.rapidFire === 'gold' ? 4 : 2) : 1; }
    get pickupMoveSpeed(): number { return this.bonusTimers.moveSpeed > 0 ? (this.activeBonusTiers.moveSpeed === 'gold' ? 3 : 1.5) : 1; }
    get bonusProgress(): Readonly<Record<TemporaryBonus, number>> {
        const progress = { ...this.bonusTimers };
        for (const kind of Object.keys(progress) as TemporaryBonus[]) {
            progress[kind] = this.bonusDurations[kind] > 0
                ? Math.min(1, progress[kind] / this.bonusDurations[kind]) : 0;
        }
        return progress;
    }

    activateBonus(kind: TemporaryBonus, tier: PickupTier = 'silver'): void {
        if (this.currentHp > 0) {
            // A weaker pickup refreshes the existing stronger bonus without downgrading it.
            this.activeBonusTiers[kind] = this.bonusTimers[kind] > 0 && this.activeBonusTiers[kind] === 'gold' ? 'gold' : tier;
            this.bonusTimers[kind] = this.bonusDurations[kind] = 10000 * this.bonusDuration;
            this.bonusPickupOrder = this.bonusPickupOrder.filter(bonus => bonus !== kind);
            if (this.bonusTimers[kind] > 0) this.bonusPickupOrder.push(kind);
        }
    }

    /** Simulation milliseconds only: paused time never consumes a bonus. */
    updateBonuses(deltaMs: number): void {
        if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
        for (const kind of Object.keys(this.bonusTimers) as TemporaryBonus[]) {
            this.bonusTimers[kind] = Math.max(0, this.bonusTimers[kind] - deltaMs);
            if (this.bonusTimers[kind] < 1e-7) this.bonusTimers[kind] = 0;
            if (this.bonusTimers[kind] === 0) delete this.activeBonusTiers[kind];
        }
        this.bonusPickupOrder = this.bonusPickupOrder.filter(kind => this.bonusTimers[kind] > 0);
    }

    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    takeDamage(amount: number) {
        const damage = Math.max(0, amount) * (1 - Math.min(1, Math.max(0, this.damageReduction)))
            * (this.bonusTimers.shield > 0 ? (this.activeBonusTiers.shield === 'gold' ? .25 : .5) : 1);
        this.damageTaken += Math.min(this.currentHp, damage);
        this.currentHp -= damage;
        if (this.currentHp <= 0) {
            this.currentHp = 0;
            this.pickupHealing = [];
            console.log('💀 Game Over');
        }
    }

    heal(amount: number) {
        if (this.currentHp <= 0 || !Number.isFinite(amount) || amount <= 0) return;
        this.currentHp += amount;
        if (this.currentHp > this.maxHp) {
            this.currentHp = this.maxHp;
        }
    }

    /** Each medkit restores its health over 400 active simulation milliseconds. */
    startPickupHealing(amount: number): void {
        if (this.currentHp <= 0 || !Number.isFinite(amount) || amount <= 0) return;
        const healing = Math.min(amount, this.maxHp - this.currentHp);
        if (healing > 0) this.pickupHealing.push({ remainingMs: 400, hpPerMs: healing / 400 });
    }

    updatePickupHealing(deltaMs: number): void {
        if (this.currentHp <= 0) {
            this.pickupHealing = [];
            return;
        }
        if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
        for (const healing of this.pickupHealing) {
            const elapsed = Math.min(deltaMs, healing.remainingMs);
            this.heal(elapsed * healing.hpPerMs);
            healing.remainingMs -= elapsed;
        }
        this.pickupHealing = this.currentHp >= this.maxHp
            ? [] : this.pickupHealing.filter(healing => healing.remainingMs > 1e-7);
    }

    /** Called only by the active simulation; regeneration ticks once per game second. */
    updateRegeneration(deltaMs: number) {
        if (this.currentHp <= 0 || this.regeneration <= 0) {
            this.regenerationElapsed = 0;
            return;
        }
        if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
        this.regenerationElapsed += deltaMs;
        const ticks = Math.floor((this.regenerationElapsed + 1e-7) / 1000);
        if (ticks === 0) return;
        this.regenerationElapsed = Math.max(0, this.regenerationElapsed - ticks * 1000);
        this.heal(ticks * this.regeneration);
    }
}
