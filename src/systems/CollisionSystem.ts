import { Enemy } from '@/entities/enemy/Enemy';
import type { PlayerController } from '@/systems/Player/PlayerController';

export class CollisionSystem {
    checkBulletEnemyCollisions(controller: PlayerController, enemies: Enemy[]): void {
        const bullets = controller.getBullets();
        const player = controller.getPlayer();

        for (const enemy of enemies) {
            for (const bullet of bullets) {
                if (enemy.checkCollision(bullet.x, bullet.y, bullet.radius)) {
                    // Угол попадания относительно врага и игрока
                    const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);

                    // Добавляем урон по врагу
                    enemy.receiveDamage(bullet.damage, angle, bullet.pushBackForce);
                    // Регистрируем попадание
                    controller.registerHit();
                    // Пуля умирает
                    bullet.isDead = true;
                }
            }
        }
    }
}
