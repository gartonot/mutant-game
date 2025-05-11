import { Bullet } from '@/entities/bullet/Bullet';
import { Enemy } from '@/entities/enemy/Enemy';
import type { PlayerController } from '@/systems/Player/PlayerController';

export class CollisionSystem {
    checkBulletEnemyCollisions(bullets: Bullet[], enemies: Enemy[], controller: PlayerController): void {
        for (const enemy of enemies) {
            for (const bullet of bullets) {
                if (enemy.checkCollision(bullet.x, bullet.y, bullet.radius)) {
                    // Угол попадания относительно врага и пули
                    const angle = Math.atan2(enemy.y - bullet.y, enemy.x - bullet.x);

                    // Добавляем урон по врагу
                    enemy.receiveDamage(bullet.damage, angle);
                    // Регистрируем попадание
                    controller.registerHit();
                    // Пуля умирает
                    bullet.isDead = true;
                }
            }
        }
    }
}
