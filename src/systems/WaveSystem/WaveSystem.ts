import { Enemy } from '@/entities/enemy/Enemy';

import { WaveConfigs } from './WaveConfig';

export class WaveSystem {
    private currentWaveIndex = 0;

    public spawnWave(): Enemy[] {
        const config = WaveConfigs[this.currentWaveIndex] || WaveConfigs[WaveConfigs.length - 1];
        const enemies: Enemy[] = [];

        for (let i = 0; i < config.count; i++) {
            const type = config.types[Math.floor(Math.random() * config.types.length)];
            const position = this.getRandomPosition();
            enemies.push(new Enemy(position.x, position.y, type));
        }

        this.currentWaveIndex++;
        return enemies;
    }

    private getRandomPosition(): { x: number; y: number } {
        const offset = 50;
        const side = Math.floor(Math.random() * 4);
        switch (side) {
            case 0: return { x: Math.random() * window.innerWidth, y: -offset };
            case 1: return { x: Math.random() * window.innerWidth, y: window.innerHeight + offset };
            case 2: return { x: -offset, y: Math.random() * window.innerHeight };
            case 3: return { x: window.innerWidth + offset, y: Math.random() * window.innerHeight };
            default: return { x: 0, y: 0 };
        }
    }
}
