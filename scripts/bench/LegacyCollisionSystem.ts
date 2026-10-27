// Frozen pre-optimization baseline, benchmark only.
import { Enemy } from '@/entities/enemy/Enemy';
import type { PlayerController } from '@/systems/Player/PlayerController';
import { Grenade } from '@/entities/bullet/Grenade';

export class CollisionSystem {
    checkBulletEnemyCollisions(controller: PlayerController, enemies: Enemy[], onExplosion?: (x: number, y: number, radius: number) => void): void {
        const bullets = controller.getBullets();
        const player = controller.getPlayer();

        for (const bullet of bullets) {
            if (!(bullet instanceof Grenade) || bullet.isDead) continue;
            if (enemies.some(enemy => !enemy.isDead && (Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < enemy.radius + bullet.radius))) bullet.detonated = true;
            if (!bullet.detonated) continue;
            let hit = false;
            // Damage every target before removal; accuracy counts a grenade hit once.
            for (const enemy of enemies) {
                if (enemy.isDead) continue;
                const distance = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
                if (distance > bullet.blastRadius + enemy.radius) continue;
                const falloff = 1 - .6 * Math.min(1, distance / bullet.blastRadius);
                enemy.receiveDamage(bullet.damage * falloff, Math.atan2(enemy.y - bullet.y, enemy.x - bullet.x), bullet.pushBackForce * falloff);
                hit = true;
            }
            if (hit) controller.registerHit();
            bullet.isDead = true;
            onExplosion?.(bullet.x, bullet.y, bullet.blastRadius);
        }

        for (const enemy of enemies) {
            for (const bullet of bullets) {
                if (enemy.isDead) break;
                if (bullet.isDead || bullet instanceof Grenade) continue;
                if ((Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < enemy.radius + bullet.radius)) {
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
