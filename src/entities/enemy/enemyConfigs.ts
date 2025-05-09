import type { IEnemyConfig } from '@entities/interfaces';

export const ENEMY_CONFIGS: Record<string, IEnemyConfig> = {
    grunt: { type: 'grunt', maxHealth: 2, damageToPlayer: 1 },
    tank: { type: 'tank', maxHealth: 5, damageToPlayer: 2 },
    boss: { type: 'boss', maxHealth: 20, damageToPlayer: 5 },
};
