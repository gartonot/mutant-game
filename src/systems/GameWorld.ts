import { MuzzleFlashEffect } from '@/effects/MuzzleFlashEffect.ts';
import { Enemy } from '@/entities/enemy/Enemy';
import { CollisionSystem } from '@/systems/CollisionSystem';
import { PlayerController } from '@/systems/Player/PlayerController';
import { UIRenderer } from '@/systems/UIRenderer';
import { WaveSystem } from '@/systems/WaveSystem/WaveSystem';
import type { IGameEntity } from '@entities/interfaces';

export class GameWorld implements IGameEntity {
    private waveSystem = new WaveSystem();
    private enemies: Enemy[] = [];
    private controller: PlayerController;
    private uiRenderer: UIRenderer;
    private collisionSystem = new CollisionSystem();
    private muzzleFlashes: MuzzleFlashEffect[] = [];

    constructor(controller: PlayerController) {
        this.controller = controller;

        setInterval(() => {
            const newEnemies = this.waveSystem.spawnWave();
            this.enemies.push(...newEnemies);
            console.log(`Волна ${this.waveSystem['currentWaveIndex']} из ${newEnemies.length} врагов`);
        }, 5000);

        this.uiRenderer = new UIRenderer(this.controller.getPlayer());
    }

    update() {
        this.enemies.forEach(enemy => {
            // Указываем врагу позицию игрока
            enemy.setTarget(this.controller.getPlayer().x, this.controller.getPlayer().y);
            // Обновляем поведение врага, чтоб он двигался к игроку
            enemy.update();

            // Проверка столкновения врага с игроком
            this.playerCollisionsEnemy(enemy);
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

        // Обновляем UI
        this.uiRenderer.update();

        // Проброс врагов в игрока
        this.controller.syncEnemies(this.enemies);

        // Обновляем все вспышки от выстрелов и удаляем те, которые не нужны
        this.muzzleFlashes.forEach(flash => flash.update());
        this.muzzleFlashes = this.muzzleFlashes.filter(flash => !flash.isExpired);
    }

    draw(ctx: CanvasRenderingContext2D) {
        // Отрисовываем врагов
        this.enemies.forEach(enemy => enemy.draw(ctx));

        // Отрисовываем вспышки от пуль
        this.muzzleFlashes.forEach(flash => flash.draw(ctx));

        // Отрисовываем UI
        this.uiRenderer.draw(ctx);
    }

    private resolveEnemyCollisions() {
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

    private playerCollisionsEnemy(enemy: Enemy) {
        const dx = enemy.x - this.controller.getPlayer().x;
        const dy = enemy.y - this.controller.getPlayer().y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < enemy.radius + this.controller.getPlayer().radius && enemy.canDamage()) {
            // Наносим игроку урон от врага
            this.controller.getPlayer().takeDamage(enemy.damage);

            // Проверяем сталкновение врага и игрока
            if (distance < enemy.radius + this.controller.getPlayer().radius) {
                this.controller.getPlayer().takeDamage(enemy.damage);

                // Вычисляем силу отталкивания
                const overlap = (enemy.radius + this.controller.getPlayer().radius) - distance;
                const pushX = (dx / distance) * overlap;
                const pushY = (dy / distance) * overlap;

                // Отталкиваем врага от игрока
                enemy.x += pushX;
                enemy.y += pushY;
            }
        }
    }

    public addMuzzleFlash(x: number, y: number, angle: number) {
        this.muzzleFlashes.push(new MuzzleFlashEffect(x, y, angle));
    }

    public getPlayerController(): PlayerController {
        return this.controller;
    }
}
