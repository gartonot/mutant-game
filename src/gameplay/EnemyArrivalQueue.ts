import type { Enemy } from '@/entities/enemy/Enemy';
import { EnemyType } from '@/entities/enemy/EnemyType';

/** Releases the already chosen roster in real time, without moving waiting enemies. */
export class EnemyArrivalQueue {
    private pending: { at: number; enemies: Enemy[] }[] = [];
    constructor(private readonly random: () => number = Math.random) {}

    schedule(enemies: Enemy[], now: number, durationMs: number) {
        const groups: Enemy[][] = [];
        for (let start = 0; start < enemies.length;) {
            const bugs = enemies[start].type === EnemyType.BUG;
            let end = start + 1;
            while (end < enemies.length && (enemies[end].type === EnemyType.BUG) === bugs) end++;
            while (start < end) {
                const left = end - start;
                let count = bugs ? (left === 4 ? 2 : Math.min(3, left)) : Math.min(left, 2 + Math.floor(this.random() * 5));
                if (!bugs && left - count === 1) count += count < 6 ? 1 : -1;
                groups.push(enemies.slice(start, start + count));
                start += count;
            }
        }
        // Ten zombies should not become just two distant bursts. Split large
        // groups until there are enough arrivals to cover this wave's window.
        while (groups.length < Math.ceil(enemies.length / 4)) {
            const index = groups.findIndex(group => group.length >= 4 && group[0].type !== EnemyType.BUG);
            if (index < 0) break;
            const group = groups[index];
            groups.splice(index, 1, group.slice(0, 2), group.slice(2));
        }
        const gaps = groups.slice(1).map(() => .65 + this.random() * .7);
        const total = gaps.reduce((sum, gap) => sum + gap, 0);
        let offset = 0;
        groups.forEach((group, index) => {
            if (index > 0) offset += gaps[index - 1];
            this.pending.push({ at: now + (total ? offset / total * durationMs : 0), enemies: group });
        });
    }

    release(now: number): Enemy[] {
        const ready: Enemy[] = [];
        this.pending = this.pending.filter(group => {
            if (group.at > now) return true;
            ready.push(...group.enemies);
            return false;
        });
        return ready;
    }
}
