import { Enemy } from '@/entities/enemy/Enemy';

import { WaveConfigs } from './WaveConfig';
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
        this.viewport = options.viewport ?? (() => ({ width: window.innerWidth, height: window.innerHeight }));
        if (!this.rules.length || this.rules.some(rule => !rule.types.length || !Number.isInteger(rule.count) || rule.count < 0)) {
            throw new Error('Wave rules require at least one enemy type and a non-negative integer count');
        }
    }

    public spawnWave(): Enemy[] {
        const config = this.rules[this.currentWaveIndex] ?? this.rules[this.rules.length - 1];
        const enemies: Enemy[] = [];

        for (let i = 0; i < config.count; i++) {
            const type = config.types[Math.floor(this.random() * config.types.length)];
            const position = this.getRandomPosition();
            enemies.push(new Enemy(position.x, position.y, type));
        }

        this.currentWaveIndex++;
        return enemies;
    }

    private getRandomPosition(): { x: number; y: number } {
        const offset = 50;
        const side = Math.floor(this.random() * 4);
        const { width, height } = this.viewport();
        switch (side) {
            case 0: return { x: this.random() * width, y: -offset };
            case 1: return { x: this.random() * width, y: height + offset };
            case 2: return { x: -offset, y: this.random() * height };
            case 3: return { x: width + offset, y: this.random() * height };
            default: return { x: 0, y: 0 };
        }
    }
}
