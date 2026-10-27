export interface CombatStats {
    maxHp: number;
    speed: number;
    damage: number;
    attackSpeed: number;
}
export interface StatModifier {
    readonly stat: keyof CombatStats;
    readonly operation: 'add' | 'percent';
    readonly value: number;
}
export const BASE_STATS: Readonly<CombatStats> = Object.freeze({ maxHp: 100, speed: 5, damage: 1, attackSpeed: 1 });

/** Percentages add together; apply once after flat additions. Never mutate the base. */
export function resolveStats(base: Readonly<CombatStats>, modifiers: readonly StatModifier[]): CombatStats {
    const result = { ...base };
    for (const stat of Object.keys(base) as (keyof CombatStats)[]) {
        let flat = 0;
        let percent = 0;
        for (const modifier of modifiers) {
            if (!Number.isFinite(modifier.value)) throw new Error('Invalid stat modifier');
            if (modifier.stat !== stat) continue;
            if (modifier.operation === 'add') flat += modifier.value;
            else percent += modifier.value;
        }
        const value = (base[stat] + flat) * (1 + percent);
        if (!Number.isFinite(value)) throw new Error(`Invalid stat: ${stat}`);
        result[stat] = Math.max(stat === 'maxHp' ? 1 : stat === 'attackSpeed' ? 0.01 : 0, value);
    }
    return result;
}
