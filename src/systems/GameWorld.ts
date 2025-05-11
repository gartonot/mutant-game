import { Enemy } from '@/entities/enemy/Enemy';
import { EnemySpawner } from '@/entities/enemy/EnemySpawner';
import { CollisionSystem } from '@/systems/CollisionSystem';
import { PlayerController } from '@/systems/Player/PlayerController';
import type { IGameEntity } from '@entities/interfaces';

export class GameWorld implements IGameEntity {
    private enemySpawner: EnemySpawner = new EnemySpawner();
    private enemies: Enemy[] = [];
    private controller: PlayerController;
    private collisionSystem: CollisionSystem = new CollisionSystem();

    constructor(controller: PlayerController) {
        this.controller = controller;

        setInterval(() => {
            const newEnemies = this.enemySpawner.spawnWave();
            this.enemies.push(...newEnemies);
            console.log(`Новая волна: ${newEnemies.length} врагов`);
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
        this.collisionSystem.checkBulletEnemyCollisions(
            this.controller.getBullets(),
            this.enemies,
            this.controller,
        );

        // Очищаем умерших врагов из массива
        this.enemies = this.enemies.filter(enemy => !enemy.isDead);
        // Получаем список живых пуль, для обновления
        const liveBullets = this.controller.getBullets().filter(bullet => !bullet.isDead);
        this.controller.setBullets(liveBullets);
    }

    draw(ctx: CanvasRenderingContext2D) {
        this.enemies.forEach(enemy => enemy.draw(ctx));
    }
}
