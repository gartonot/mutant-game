import { Enemy } from '@/entities/enemy/Enemy';
import { EnemyType } from '@/entities/enemy/EnemyType';
import { getArenaSize } from '@/gameplay/Arena';

import { BOSS_WAVE_INTERVAL, SURVIVAL_WAVE_COUNT, WaveConfigs } from './WaveConfig';
import type { IWaveRule } from './WaveConfig';

export interface WaveSystemOptions {
    rules?: readonly IWaveRule[];
    random?: () => number;
    viewport?: () => { width: number; height: number };
}

export class WaveSystem {
    private currentWaveIndex = 0;
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

    public spawnWave(): Enemy[] {
        if (this.rules === WaveConfigs && this.currentWaveIndex >= SURVIVAL_WAVE_COUNT) return [];
        const config = this.rules[this.currentWaveIndex] ?? this.rules[this.rules.length - 1];
        const enemies: Enemy[] = [];

        for (let i = 0; i < config.count; i++) {
            // Keep one type draw per enemy so seeded position streams remain stable.
            const typeRoll = this.random();
            const type = config.composition?.[i] ?? config.types[Math.floor(typeRoll * config.types.length)];
            enemies.push(this.createEnemy(type));
        }

        // Default survival waves add a boss independently of any living enemies.
        if (this.rules === WaveConfigs && (this.currentWaveIndex + 1) % BOSS_WAVE_INTERVAL === 0) {
            enemies.push(this.createEnemy(EnemyType.BOSS));
        }

        this.currentWaveIndex++;
        return enemies;
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
