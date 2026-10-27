import type { WeaponCategory } from './ids';

/** Points share one arsenal budget; each button click spends or returns five. */
export type ArsenalAllocation = Readonly<Record<WeaponCategory, number>>;
export const ARSENAL_STEP = 5;
export const ARSENAL_LIMIT = 50;
export const ARSENAL_CATEGORIES: readonly WeaponCategory[] = ['sidearm', 'automatic', 'shotgun', 'special', 'scientific'];
export const EMPTY_ARSENAL: ArsenalAllocation = Object.freeze({ sidearm: 0, automatic: 0, shotgun: 0, special: 0, scientific: 0 });

/** Additive fractions relative to a category's unupgraded weapon values. */
export function arsenalBonuses(points: number): { attackSpeed: number; damage: number; ammo: number } {
    if (!Number.isInteger(points) || points < 0 || points > ARSENAL_LIMIT || points % ARSENAL_STEP !== 0) {
        throw new Error('Invalid arsenal points');
    }
    const steps = points / ARSENAL_STEP;
    return { attackSpeed: steps * .02, damage: steps * .04, ammo: steps * .25 };
}

export function validateArsenal(allocation: ArsenalAllocation): void {
    if (!allocation || typeof allocation !== 'object' || Array.isArray(allocation) ||
        Object.keys(allocation).length !== ARSENAL_CATEGORIES.length ||
        ARSENAL_CATEGORIES.some(category => !Object.prototype.hasOwnProperty.call(allocation, category))) {
        throw new Error('Invalid arsenal allocation');
    }
    const points = ARSENAL_CATEGORIES.map(category => allocation[category]);
    if (points.some(value => !Number.isInteger(value) || value < 0 || value % ARSENAL_STEP !== 0)) {
        throw new Error('Arsenal points must be nonnegative multiples of five');
    }
    if (points.reduce((total, value) => total + value, 0) > ARSENAL_LIMIT) throw new Error('Arsenal limit exceeded');
}
