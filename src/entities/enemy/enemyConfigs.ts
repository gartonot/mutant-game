import { EnemyType } from '@entities/enemy/EnemyType.ts';
import type { IEnemyConfig } from '@entities/interfaces';

export const ENEMY_CONFIGS: Record<string, IEnemyConfig> = {
    [EnemyType.GRUNT]: {
        type: EnemyType.GRUNT,
        maxHealth: 2,
        damageToPlayer: 1,
    },
    [EnemyType.TANK]: {
        type: EnemyType.TANK,
        maxHealth: 5,
        damageToPlayer: 2,
    },
    [EnemyType.BOSS]: {
        type: EnemyType.BOSS,
        maxHealth: 20,
        damageToPlayer: 5,
    },
};
