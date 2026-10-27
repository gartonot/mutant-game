import type { CombatStats } from './stats';

/** Allocations are upgrade points, with five points spent per click. */
export interface ImplantAllocation {
    readonly health: number;
    readonly attackSpeed: number;
    readonly moveSpeed: number;
    /** Missing in older saved allocations; equivalent to zero. */
    readonly damage?: number;
    /** Missing in older saved allocations; equivalent to zero. */
    readonly armor?: number;
}
export const IMPLANT_STEP = 5;
export const IMPLANT_LIMIT = 100;
export const EMPTY_IMPLANTS: Readonly<ImplantAllocation> = Object.freeze({ health: 0, attackSpeed: 0, moveSpeed: 0, damage: 0, armor: 0 });

export function validateImplants(allocation: ImplantAllocation): void {
    if (!allocation || typeof allocation !== 'object') throw new Error('Invalid implant allocation');
    const damage = 'damage' in allocation ? allocation.damage : 0;
    if (typeof damage !== 'number') throw new Error('Invalid damage implant points');
    const armor = 'armor' in allocation ? allocation.armor : 0;
    if (typeof armor !== 'number') throw new Error('Invalid armor implant points');
    const points = [allocation.health, allocation.attackSpeed, allocation.moveSpeed, damage, armor];
    if (points.some(value => !Number.isInteger(value) || value < 0 || value % IMPLANT_STEP !== 0)) {
        throw new Error('Implant points must be nonnegative multiples of five');
    }
    if (points.reduce((total, value) => total + value, 0) > IMPLANT_LIMIT) throw new Error('Implant limit exceeded');
}

/** Apply to resolved hero stats so each health step always adds exactly ten HP. */
export function applyImplants(stats: Readonly<CombatStats>, allocation: ImplantAllocation = EMPTY_IMPLANTS): CombatStats {
    validateImplants(allocation);
    return {
        ...stats,
        maxHp: stats.maxHp + allocation.health / IMPLANT_STEP * 10,
        attackSpeed: stats.attackSpeed * (1 + allocation.attackSpeed / IMPLANT_STEP * .02),
        speed: stats.speed * (1 + allocation.moveSpeed / IMPLANT_STEP * .03),
        damage: stats.damage * (1 + (allocation.damage ?? 0) / IMPLANT_STEP * .05),
        damageReduction: Math.min(1, stats.damageReduction + (allocation.armor ?? 0) / IMPLANT_STEP * .02),
    };
}
