import { Bullet } from '@/entities/bullet/Bullet';
import { Enemy } from '@/entities/enemy/Enemy';

export class CollisionSystem {
    checkBulletEnemyCollisions(bullets: Bullet[], enemies: Enemy[]): void {
        for (const enemy of enemies) {
            for (const bullet of bullets) {
                if (enemy.checkCollision(bullet.x, bullet.y, bullet.radius)) {
                    // Добавляем урон по врагу
                    enemy.receiveDamage(bullet.damage);
                    bullet.isDead = true;
                }
            }
        }
    }
}
