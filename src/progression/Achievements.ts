import { achievements } from './AchievementDefinitions';
import { emptyBonuses, metricDefaults } from './AchievementTypes';
import type { Achievement, Metrics, RunStats, Totals } from './AchievementTypes';
export { achievements, emptyBonuses };
export type { Achievement, Bonuses, RunStats, Totals } from './AchievementTypes';

export const emptyTotals = (): Totals => ({ ...metricDefaults, games: 0, bestSeconds: 0 });
export function levelOf(achievement: Achievement, totals: Totals): number {
    const value = totals[achievement.metric];
    if (achievement.goal) return Math.floor(value / achievement.goal);
    return (achievement.thresholds ?? []).filter((threshold) => value >= threshold).length;
}
export function progressOf(achievement: Achievement, totals: Totals) {
    const level = levelOf(achievement, totals);
    const thresholds = achievement.thresholds ?? [];
    const complete = !achievement.goal && level === thresholds.length;
    const target = achievement.goal ?? thresholds[level] ?? thresholds[thresholds.length - 1];
    const value = achievement.goal ? totals[achievement.metric] % achievement.goal : Math.min(totals[achievement.metric], target);
    const divisor = achievement.displayDivisor ?? 1;
    return { level, complete, target: target / divisor, value: Math.floor(value / divisor), unit: achievement.unit ? ` ${achievement.unit}` : '' };
}
export function bonusesOf(totals: Totals) {
    return achievements.reduce((bonuses, achievement) => {
        bonuses[achievement.effect] += levelOf(achievement, totals) * achievement.perLevel;
        return bonuses;
    }, emptyBonuses());
}
export function formatBonus(effect: keyof ReturnType<typeof emptyBonuses>, amount: number): string {
    const percent = Math.round(amount * 100);
    switch (effect) {
        case 'health': return `+${amount} к очкам жизни`;
        case 'damage': return `+${percent}% к урону оружия`;
        case 'speed': return `+${percent}% к скорости`;
        case 'bonusRadius': return `+${percent}% к радиусу бонусов`;
        case 'normalAmmo': return `+${percent}% обычных патронов`;
        case 'medkitHealing': return `+${amount} жизни в аптечке`;
        case 'purchasePoints': return `+${amount} очков покупки`;
        case 'equipmentGather': return `+${percent}% снаряжения при сборе`;
    }
}
export function formatTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
const storageKey = 'mutant.progress.v1';
export class ProgressStore {
    totals = emptyTotals();
    storageAvailable = true;

    constructor() {
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return;
            const saved: unknown = JSON.parse(raw);
            if (!saved || typeof saved !== 'object') return;
            for (const key of Object.keys(this.totals) as (keyof Totals)[]) {
                const value = (saved as Record<string, unknown>)[key];
                if (typeof value === 'number' && Number.isFinite(value) && value >= 0) this.totals[key] = Math.min(value, Number.MAX_SAFE_INTEGER);
            }
        } catch (error) { if (!(error instanceof SyntaxError)) this.storageAvailable = false; }
    }

    record(run: RunStats): { before: Totals; after: Totals } {
        const before = { ...this.totals };
        for (const key of Object.keys(metricDefaults) as (keyof Metrics)[]) {
            const value = run[key];
            if (typeof value === 'number' && Number.isFinite(value) && value >= 0) this.totals[key] += value;
        }
        this.totals.games++;
        this.totals.bestSeconds = Math.max(before.bestSeconds, this.totals.seconds - before.seconds);
        try {
            localStorage.setItem(storageKey, JSON.stringify(this.totals));
            this.storageAvailable = true;
        }
        catch { this.storageAvailable = false; }
        return { before, after: { ...this.totals } };
    }
}
