import type { Enemy } from '@/entities/enemy/Enemy';
import type { Player } from '@/entities/player/Player';

export function resolvePlayerContact(player: Player, enemy: Enemy, moving: boolean, simulationTime: number, width: number, height: number): void {
    const dx = enemy.x - player.x, dy = enemy.y - player.y;
    const radius = enemy.radius + player.radius;
    const squared = dx * dx + dy * dy;
    if (squared >= radius * radius) return;
    if (enemy.canDamage(simulationTime)) player.takeDamage(enemy.damage);
    const distance = Math.sqrt(squared);
    const overlap = radius - distance;
    const x = (distance > 0 ? dx / distance : 1) * overlap;
    const y = (distance > 0 ? dy / distance : 0) * overlap;
    const enemyShare = moving ? .7 : .3;
    enemy.x += x * enemyShare; enemy.y += y * enemyShare;
    player.x -= x * (1 - enemyShare); player.y -= y * (1 - enemyShare);
    player.x = Math.max(player.radius, Math.min(width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(height - player.radius, player.y));
}
