import { Bullet } from '@/entities/bullet/Bullet';
import { Enemy } from '@/entities/enemy/Enemy';
import type { PlayerController } from '@/systems/Player/PlayerController';

export class CollisionSystem {
    checkBulletEnemyCollisions(bullets: Bullet[], enemies: Enemy[], controller: PlayerController): void {
        for (const enemy of enemies) {
            for (const bullet of bullets) {
                if (enemy.checkCollision(bullet.x, bullet.y, bullet.radius)) {
                    // Добавляем урон по врагу
                    enemy.receiveDamage(bullet.damage);
                    controller.registerHit();
                    bullet.isDead = true;
                }
            }
        }
    }
}
