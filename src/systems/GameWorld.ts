import { Enemy } from '@/entities/enemy/Enemy';
import type { IUpdatable, IDrawable } from '@/entities/interfaces/interfaces';
import { CollisionSystem } from '@/systems/CollisionSystem';
import { PlayerController } from '@/systems/PlayerController';

export class GameWorld implements IUpdatable, IDrawable {
    private enemies: Enemy[] = [];
    private controller: PlayerController;
    private collisionSystem: CollisionSystem = new CollisionSystem();

    constructor(controller: PlayerController) {
        this.controller = controller;

        // Первый враг для старта
        this.enemies.push(new Enemy(0, 0));
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
