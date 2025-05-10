import { Enemy } from './Enemy';
import { EnemyType } from './EnemyType';

export class EnemySpawner {
    private waveSize: number = 1;

    public spawnWave(): Enemy[] {
        const enemies: Enemy[] = [];

        for (let i = 0; i < this.waveSize; i++) {
            const position = this.getRandomPosition();
            enemies.push(new Enemy(position.x, position.y, EnemyType.GRUNT));
        }
        // Увеличиваем размер волны каждый раз
        this.waveSize += 1;

        return enemies;
    }

    private getRandomPosition(): { x: number; y: number } {
        const offset = 50;
        const sides = ['top', 'bottom', 'left', 'right'];
        const side = sides[Math.floor(Math.random() * sides.length)];

        switch (side) {
            case 'top':
                return { x: Math.random() * window.innerWidth, y: -offset };
            case 'bottom':
                return { x: Math.random() * window.innerWidth, y: window.innerHeight + offset };
            case 'left':
                return { x: -offset, y: Math.random() * window.innerHeight };
            case 'right':
                return { x: window.innerWidth + offset, y: Math.random() * window.innerHeight };
            default:
                return { x: 0, y: 0 };
        }
    }
}
