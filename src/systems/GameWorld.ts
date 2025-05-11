import { Enemy } from '@/entities/enemy/Enemy';
import { CollisionSystem } from '@/systems/CollisionSystem';
import { PlayerController } from '@/systems/Player/PlayerController';
import { WaveSystem } from '@/systems/WaveSystem/WaveSystem';
import type { IGameEntity } from '@entities/interfaces';

export class GameWorld implements IGameEntity {
    private waveSystem = new WaveSystem();
    private enemies: Enemy[] = [];
    private controller: PlayerController;
    private collisionSystem: CollisionSystem = new CollisionSystem();

    constructor(controller: PlayerController) {
        this.controller = controller;

        setInterval(() => {
            const newEnemies = this.waveSystem.spawnWave();
            this.enemies.push(...newEnemies);
            console.log(`Волна ${this.waveSystem['currentWaveIndex']} из ${newEnemies.length} врагов`);
        }, 5000);
    }

    update() {
        this.enemies.forEach(enemy => {
            // Указываем врагу позицию игрока
            enemy.setTarget(this.controller.getPlayer().x, this.controller.getPlayer().y);
            // Обновляем поведение врага, чтоб он двигался к игроку
            enemy.update();
        });

        // Проверяем есть ли столкновении врага и пули, если да - для обоих флаг isDead = true
        this.collisionSystem.checkBulletEnemyCollisions(this.controller, this.enemies);

        // Очищаем умерших врагов из массива
        this.enemies = this.enemies.filter(enemy => {
            if (enemy.isDead) {
                this.controller.registerKill();
                return false;
            }
            return true;
        });

        // Получаем список живых пуль, для обновления
        const liveBullets = this.controller.getBullets().filter(bullet => !bullet.isDead);
        this.controller.setBullets(liveBullets);

        // Враги не входят друг в друга
        this.resolveEnemyCollisions();
    }

    draw(ctx: CanvasRenderingContext2D) {
        this.enemies.forEach(enemy => enemy.draw(ctx));
    }

    private resolveEnemyCollisions(): void {
        for (let i = 0; i < this.enemies.length; i++) {
            for (let j = i + 1; j < this.enemies.length; j++) {
                const a = this.enemies[i];
                const b = this.enemies[j];

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const distanceSq = dx * dx + dy * dy;
                const minDist = a.radius + b.radius;

                if (distanceSq < minDist * minDist) {
                    const distance = Math.sqrt(distanceSq) || 1;
                    const overlap = (minDist - distance) / 2;

                    const offsetX = (dx / distance) * overlap;
                    const offsetY = (dy / distance) * overlap;

                    a.x -= offsetX;
                    a.y -= offsetY;
                    b.x += offsetX;
                    b.y += offsetY;
                }
            }
        }
    }
}
