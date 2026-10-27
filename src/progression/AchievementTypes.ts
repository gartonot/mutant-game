// Add a counter here when its gameplay mechanic becomes available.
export const metricDefaults = {
    kills: 0,
    seconds: 0,
    waves: 0,
    damage: 0,
    offscreenKills: 0,
    bonusKills: 0,
    zombieKills: 0,
    equipment: 0,
};
export type Metrics = typeof metricDefaults;
export type Totals = Metrics & { games: number; bestSeconds: number };
export type RunStats = Pick<Metrics, 'kills' | 'seconds' | 'waves' | 'damage'>
    & Partial<Omit<Metrics, 'kills' | 'seconds' | 'waves' | 'damage'>>
    & { shots: number; accuracy: number };
export interface Bonuses {
    health: number;
    damage: number;
    speed: number;
    bonusRadius: number;
    normalAmmo: number;
    medkitHealing: number;
    purchasePoints: number;
    equipmentGather: number;
}
export interface Achievement {
    id: string;
    name: string;
    metric: keyof Metrics;
    // Repeated goal, or explicit cumulative thresholds for existing prototype rewards.
    goal?: number;
    thresholds?: number[];
    displayDivisor?: number;
    unit?: string;
    requirement: string;
    bonus: string;
    effect: keyof Bonuses;
    perLevel: number;
    icon: string;
    tracking: 'active' | 'pending';
}
export const emptyBonuses = (): Bonuses => ({
    health: 0, damage: 0, speed: 0, bonusRadius: 0, normalAmmo: 0,
    medkitHealing: 0, purchasePoints: 0, equipmentGather: 0,
});
