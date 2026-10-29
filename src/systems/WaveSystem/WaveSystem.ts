import { Enemy } from '@/entities/enemy/Enemy';
import { EnemyType } from '@/entities/enemy/EnemyType';
import { getArenaSize } from '@/gameplay/Arena';

import { BOSS_SEQUENCE, BOSS_WAVE_INTERVAL, SURVIVAL_WAVE_COUNT, WaveConfigs } from './WaveConfig';
import type { IWaveRule } from './WaveConfig';

export interface WaveSystemOptions {
    rules?: readonly IWaveRule[];
    random?: () => number;
    viewport?: () => { width: number; height: number };
}

export class WaveSystem {
    private currentWaveIndex = 0;
    private nextBossIndex = 0;
    private lastBoss?: Enemy;
    private ingressSide = 2;
    private readonly rules: readonly IWaveRule[];
    private readonly random: () => number;
    private readonly viewport: () => { width: number; height: number };

    constructor(options: WaveSystemOptions = {}) {
        this.rules = options.rules ?? WaveConfigs;
        this.random = options.random ?? Math.random;
        this.viewport = options.viewport ?? (() => getArenaSize());
        if (!this.rules.length || this.rules.some(rule =>
            !rule.types.length || !Number.isInteger(rule.count) || rule.count < 0 ||
            (rule.composition !== undefined && (rule.composition.length !== rule.count ||
                rule.composition.some(type => !rule.types.includes(type)))))) {
            throw new Error('Wave rules require at least one enemy type and a non-negative integer count');
        }
    }

    public spawnWave(bossOccupied = false): Enemy[] {
        if (this.rules === WaveConfigs && this.currentWaveIndex >= SURVIVAL_WAVE_COUNT) return [];
        const config = this.rules[this.currentWaveIndex] ?? this.rules[this.rules.length - 1];
        const enemies: Enemy[] = [];
        const survival = this.rules === WaveConfigs;
        // Hold the dominant entry front across several waves, like a sustained
        // crowd rather than teleporting its source to a new edge every group.
        const sideRoll = survival ? this.random() : 0;
        if (this.currentWaveIndex % 3 === 0) this.ingressSide = sideRoll < .4 ? 2 : sideRoll < .8 ? 3 : sideRoll < .9 ? 0 : 1;
        const side = this.ingressSide;
        const anchors = survival ? [.15 + this.random() * .7, .15 + this.random() * .7] : [];
        const bugCount = survival ? config.composition!.filter(type => type === EnemyType.BUG).length : 0;
        let remainingBugs = bugCount;
        let bugGroup = 0;
        let bugInGroup = 0;
        let bugGroupSize = remainingBugs === 4 ? 2 : Math.min(3, remainingBugs);
        let gruntsLeft = survival ? config.composition!.filter(type => type === EnemyType.GRUNT).length : 0;
        let gruntGroupLeft = 0, gruntIndex = 0, gruntGroup = 0, gruntSide = side;
        let gruntAnchor = 0;

        for (let i = 0; i < config.count; i++) {
            // Keep one type draw per enemy so seeded position streams remain stable.
            const typeRoll = this.random();
            const type = config.composition?.[i] ?? config.types[Math.floor(typeRoll * config.types.length)];
            if (survival) {
                if (type === EnemyType.GRUNT) {
                    if (gruntGroupLeft === 0) {
                        let size = Math.min(gruntsLeft, 2 + Math.floor(this.random() * 5));
                        if (gruntsLeft - size === 1) size = size === 6 ? 5 : size + 1;
                        gruntGroupLeft = size;
                        gruntIndex = 0;
                        // Broad entry band with overlapping subgroups. Most keep
                        // feeding the main front; a minority pressure the other side.
                        gruntAnchor = .25 + ((gruntGroup + this.currentWaveIndex) % 3) * .25 + (this.random() - .5) * .08;
                        gruntSide = gruntGroup === 0 || this.random() < .7 ? side : side ^ 1;
                        gruntGroup++;
                    }
                    enemies.push(this.createPackEnemy(type, gruntSide, gruntAnchor, gruntIndex++));
                    gruntGroupLeft--; gruntsLeft--;
                    continue;
                }
                if (type === EnemyType.BUG) {
                    // Keep each pair/trio together at entry; later groups enter from
                    // the opposite flank instead of splitting a pair between edges.
                    const flank = (bugGroup + 1) % 2;
                    enemies.push(this.createPackEnemy(type, flank ? side ^ 1 : side, anchors[flank], bugInGroup));
                    bugInGroup++;
                    if (bugInGroup === bugGroupSize) {
                        remainingBugs -= bugGroupSize;
                        bugGroup++;
                        bugInGroup = 0;
                        bugGroupSize = remainingBugs === 4 ? 2 : Math.min(3, remainingBugs);
                    }
                    continue;
                }
                const pack = i < Math.ceil(config.count / 2) ? 0 : 1;
                enemies.push(this.createPackEnemy(type, pack ? side ^ 1 : side, anchors[pack], i % Math.ceil(config.count / 2)));
            } else enemies.push(this.createEnemy(type));
        }

        // A missed minute never skips the next identity or spawns late between minute marks.
        if (survival && (this.currentWaveIndex + 1) % BOSS_WAVE_INTERVAL === 0 &&
            !bossOccupied && (!this.lastBoss || this.lastBoss.isDead) && this.nextBossIndex < BOSS_SEQUENCE.length) {
            const type = BOSS_SEQUENCE[this.nextBossIndex++];
            this.lastBoss = this.createPackEnemy(type, side, .5, 0);
            enemies.push(this.lastBoss);
        }

        this.currentWaveIndex++;
        return enemies;
    }

    private createPackEnemy(type: EnemyType, side: number, anchor: number, index: number): Enemy {
        const { width, height } = this.viewport();
        const grunt = type === EnemyType.GRUNT;
        // Arrival timing belongs to the release queue, not long invisible columns.
        const offset = 40 + Math.floor(index / 3) * (grunt ? 24 : 35);
        const spread = (index % 3 - 1) * (grunt ? 55 : 38) + (this.random() - .5) * 14;
        const y = Math.max(35, Math.min(height - 35, anchor * height + spread));
        const x = Math.max(35, Math.min(width - 35, anchor * width + spread));
        return new Enemy(side === 2 ? -offset : side === 3 ? width + offset : x,
            side === 0 ? -offset : side === 1 ? height + offset : y, type);
    }

    private createEnemy(type: EnemyType): Enemy {
        const { width, height } = this.viewport();
        const position = this.getRandomPosition(width, height);
        return new Enemy(position.x, position.y, type);
    }

    private getRandomPosition(width: number, height: number): { x: number; y: number } {
        const offset = 50;
        const side = Math.floor(this.random() * 4);
        switch (side) {
            case 0: return { x: this.random() * width, y: -offset };
            case 1: return { x: this.random() * width, y: height + offset };
            case 2: return { x: -offset, y: this.random() * height };
            case 3: return { x: width + offset, y: this.random() * height };
            default: return { x: 0, y: 0 };
        }
    }
}
