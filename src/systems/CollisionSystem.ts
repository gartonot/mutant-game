import { Beam } from '@/entities/bullet/Beam';
import { Bullet } from '@/entities/bullet/Bullet';
import { Flame } from '@/entities/bullet/Flame';
import { Grenade } from '@/entities/bullet/Grenade';
import type { Enemy } from '@/entities/enemy/Enemy';
import type { PlayerController } from '@/systems/Player/PlayerController';

import { segmentHit } from './spatial/segmentHit';
import { SpatialGrid } from './spatial/SpatialGrid';

export class CollisionSystem {
    private grid = new SpatialGrid<Enemy>();
    private candidates: Enemy[] = [];
    checks = 0;
    checkBulletEnemyCollisions(controller: PlayerController, enemies: Enemy[], onExplosion?: (x: number, y: number, radius: number, plasma?: boolean) => void): void {
        this.grid.rebuild(enemies);
        this.checks = 0;
        const fragments: Bullet[] = [];
        for (const bullet of controller.getBullets()) {
            if (bullet.isDead || bullet.collisionResolved) continue;
            const beam = bullet instanceof Beam ? bullet : null;
            this.grid.query(Math.min(bullet.previousX, bullet.x, beam?.sweepStartX ?? bullet.x, beam?.sweepEndX ?? bullet.x) - bullet.radius, Math.min(bullet.previousY, bullet.y, beam?.sweepStartY ?? bullet.y, beam?.sweepEndY ?? bullet.y) - bullet.radius,
                Math.max(bullet.previousX, bullet.x, beam?.sweepStartX ?? bullet.x, beam?.sweepEndX ?? bullet.x) + bullet.radius, Math.max(bullet.previousY, bullet.y, beam?.sweepStartY ?? bullet.y, beam?.sweepEndY ?? bullet.y) + bullet.radius, this.candidates);
            if (bullet.piercing) {
                for (const enemy of this.candidates) {
                    if (enemy.isDead || ((bullet instanceof Flame || bullet instanceof Beam) && bullet.touched.has(enemy))) continue;
                    this.checks++;
                    const hit = beam ? beam.intersects(enemy.x, enemy.y, enemy.radius + bullet.radius) :
                        segmentHit(bullet.previousX, bullet.previousY, bullet.x, bullet.y, enemy.x, enemy.y, enemy.radius + bullet.radius) !== null;
                    if (!hit) continue;
                    enemy.receiveDamage(bullet.damage, Math.atan2(bullet.dy, bullet.dx), bullet.pushBackForce);
                    enemy.applyEffect(bullet.effect); this.grid.relocate(enemy);
                    if (bullet instanceof Flame || bullet instanceof Beam) bullet.touched.add(enemy);
                    if (!bullet.hitRegistered) { controller.registerHit(); bullet.hitRegistered = true; }
                }
                bullet.collisionResolved = !(bullet instanceof Flame);
                continue;
            }
            let target: Enemy | undefined;
            let first = Infinity;
            for (const enemy of this.candidates) {
                if (enemy.isDead) continue;
                this.checks++;
                const t = segmentHit(bullet.previousX, bullet.previousY, bullet.x, bullet.y, enemy.x, enemy.y, enemy.radius + bullet.radius);
                if (t !== null && t < first) { first = t; target = enemy; }
            }
            if (bullet instanceof Grenade) {
                if (target) {
                    bullet.x = bullet.previousX + (bullet.x - bullet.previousX) * first;
                    bullet.y = bullet.previousY + (bullet.y - bullet.previousY) * first;
                    bullet.detonated = true;
                }
                if (!bullet.detonated) continue;
                const radius = bullet.blastRadius;
                this.grid.query(bullet.x - radius, bullet.y - radius, bullet.x + radius, bullet.y + radius, this.candidates);
                let hit = false;
                for (const enemy of this.candidates) {
                    if (enemy.isDead) continue;
                    this.checks++;
                    const x = enemy.x - bullet.x, y = enemy.y - bullet.y;
                    const squared = x * x + y * y;
                    if (squared > (radius + enemy.radius) ** 2) continue;
                    const falloff = 1 - .6 * Math.min(1, Math.sqrt(squared) / radius);
                    enemy.receiveDamage(bullet.damage * falloff, Math.atan2(y, x), bullet.pushBackForce * falloff);
                    enemy.applyEffect(bullet.effect);
                    this.grid.relocate(enemy);
                    hit = true;
                }
                if (hit) { controller.registerHit(); bullet.hitRegistered = true; }
                bullet.isDead = true;
                onExplosion?.(bullet.x, bullet.y, radius, bullet.variant === 'plasma');
                if (bullet.variant === 'skull') {
                    for (let i = 0; i < 8; i++) fragments.push(new Bullet(bullet.x, bullet.y, i * Math.PI / 4, bullet.damage * .3, 12, 4));
                }
            } else if (target) {
                target.receiveDamage(bullet.damage, Math.atan2(bullet.dy, bullet.dx), bullet.pushBackForce);
                target.applyEffect(bullet.effect);
                this.grid.relocate(target);
                controller.registerHit();
                bullet.hitRegistered = true;
                bullet.isDead = true;
            }
        }
        if (fragments.length) { controller.getBullets().push(...fragments); controller.registerProjectiles(fragments.length); }
    }
}
