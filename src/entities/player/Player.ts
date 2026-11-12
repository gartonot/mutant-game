import type { CharacterId, WeaponId } from '@/gameplay/ids';
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
    abilityMoveSpeed = 1;
    abilityBlocksShooting = false;
    abilityInvisible = false;
    abilityForm: 'mutant' | 'storm' | null = null;
    abilityPoseProgress: number | null = null;
    abilityPoseAngle = 0;
    private enemySlowMs = 0;
    private enemySlowFactor = 1;
    private enemyRootMs = 0;
    get enemyMoveFactor(): number { return this.enemyRootMs > 0 ? 0 : this.enemySlowMs > 0 ? this.enemySlowFactor : 1; }
    get isEnemyRooted(): boolean { return this.enemyRootMs > 0; }
    applyEnemySlow(durationMs: number, factor = .6): void {
        if (!Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(factor)) return;
        this.enemySlowMs = Math.max(this.enemySlowMs, durationMs);
        this.enemySlowFactor = Math.min(this.enemySlowFactor, Math.max(.2, Math.min(1, factor)));
    }
    applyEnemyRoot(durationMs: number): void {
        if (Number.isFinite(durationMs) && durationMs > 0) this.enemyRootMs = Math.max(this.enemyRootMs, durationMs);
    }
    updateEnemyEffects(deltaMs: number): void {
        if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
        this.enemySlowMs = Math.max(0, this.enemySlowMs - deltaMs);
        this.enemyRootMs = Math.max(0, this.enemyRootMs - deltaMs);
        if (this.enemySlowMs === 0) this.enemySlowFactor = 1;
    }

    // Здоровье игрока
    maxHp = 100;
    currentHp = 100;
    damageTaken = 0;
    healingReceived = 0;
    damageReduction = 0;
    regeneration = 0;
    bonusGroundDuration = 1;
    bonusDuration = 1;
    private regenerationElapsed = 0;
    private healingCourses: { remainingHp: number; remainingMs: number }[] = [];
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
            this.healingCourses = []; this.regenerationElapsed = 0;
            console.log('💀 Game Over');
        }
    }

    /** Reserve only HP still missing after previously accepted healing finishes. */
    private get unreservedMissingHp(): number {
        const pending = this.healingCourses.reduce((sum, course) => sum + course.remainingHp, 0);
        return Math.max(0, this.maxHp - this.currentHp - pending);
    }

    private creditHealing(amount: number): void {
        const received = Math.min(this.maxHp - this.currentHp, amount);
        if (received <= 0) return;
        this.currentHp += received;
        this.healingReceived += received;
    }

    /** Award a discrete heal over simulation time. Damage does not enlarge or cancel the accepted course. */
    heal(amount: number, durationMs = 400): void {
        if (this.currentHp <= 0 || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(durationMs) || durationMs <= 0) return;
        const accepted = Math.min(amount, this.unreservedMissingHp);
        if (accepted > 0) this.healingCourses.push({ remainingHp: accepted, remainingMs: durationMs });
    }

    updateHealing(deltaMs: number): void {
        if (this.currentHp <= 0) {
            this.healingCourses.length = 0;
            this.regenerationElapsed = 0;
            return;
        }
        if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
        if (!Number.isFinite(this.regeneration) || this.regeneration <= 0) {
            this.regenerationElapsed = 0;
            this.advanceHealingCourses(deltaMs);
            return;
        }
        // Keep the original one-second award clock. A new tick starts its own 400 ms course
        // at the boundary, even when a large update spans several award and finish times.
        let remaining = deltaMs;
        while (remaining > 0) {
            if (this.currentHp >= this.maxHp && !this.healingCourses.length) {
                this.regenerationElapsed = (this.regenerationElapsed + remaining) % 1000;
                break;
            }
            const step = Math.min(remaining, 1000 - this.regenerationElapsed);
            this.advanceHealingCourses(step);
            this.regenerationElapsed += step;
            remaining -= step;
            if (this.regenerationElapsed >= 1000 - 1e-7) {
                this.regenerationElapsed = 0;
                this.heal(this.regeneration);
            }
        }
    }

    private advanceHealingCourses(deltaMs: number): void {
        if (!this.healingCourses.length) return;
        for (const course of this.healingCourses) {
            const elapsed = Math.min(deltaMs, course.remainingMs);
            const amount = course.remainingHp * (elapsed / course.remainingMs);
            this.creditHealing(amount);
            course.remainingMs -= elapsed;
            course.remainingHp -= amount;
        }
        this.healingCourses = this.healingCourses.filter(course => course.remainingMs > 0);
    }

    /** Continuous sources award only the fraction earned in this active simulation step. */
    healAtRate(hpPerSecond: number, deltaMs: number): void {
        if (this.currentHp <= 0 || !Number.isFinite(hpPerSecond) || hpPerSecond <= 0 || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
        this.creditHealing(Math.min(this.unreservedMissingHp, hpPerSecond * deltaMs / 1000));
    }

}
