import type { Enemy } from '@/entities/enemy/Enemy';
import type { PickupTier } from './PickupVariants';

export type BlastPickupKind = 'iceBlast' | 'fireBlast';

export function getPickupBlast(kind: BlastPickupKind, tier: PickupTier = 'silver') {
    const gold = tier === 'gold';
    return kind === 'iceBlast'
        ? { radius: 210, damage: gold ? 2 : 1, slowFactor: gold ? .25 : .5, slowMs: gold ? 8000 : 4000 }
        : { radius: 315, damage: gold ? 12 : 6, slowFactor: 1, slowMs: 0 };
}

/** Damage resolves once at collection; the expanding wave is visual only. */
export function applyPickupBlast(kind: BlastPickupKind, tier: PickupTier, x: number, y: number,
    enemies: readonly Enemy[]) {
    const blast = getPickupBlast(kind, tier);
    for (const enemy of enemies) {
        if (enemy.isDead || Math.hypot(enemy.x - x, enemy.y - y) > blast.radius) continue;
        enemy.receiveDamage(blast.damage, Math.atan2(enemy.y - y, enemy.x - x), 0);
        if (!enemy.isDead && blast.slowMs) enemy.applyEffect({ slowMs: blast.slowMs, slowFactor: blast.slowFactor });
    }
    return blast;
}
