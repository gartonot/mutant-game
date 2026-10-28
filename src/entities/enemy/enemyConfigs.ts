import { EnemyType } from '@entities/enemy/EnemyType.ts';
import type { IEnemyConfig } from '@entities/interfaces';

export const ENEMY_CONFIGS: Record<EnemyType, IEnemyConfig> = {
    [EnemyType.GRUNT]: {
        type: EnemyType.GRUNT,
        maxHealth: 2,
        damageToPlayer: 2, radius: 25, speed: 1, color: '#3d361a',
    },
    [EnemyType.TANK]: {
        type: EnemyType.TANK,
        maxHealth: 6,
        damageToPlayer: 2, radius: 25, speed: .75, color: '#093908',
    },
    [EnemyType.BOSS]: {
        type: EnemyType.BOSS,
        maxHealth: 20,
        damageToPlayer: 2, radius: 40, speed: 1, color: '#d22e2e',
    },
    [EnemyType.BUG]: {
        type: EnemyType.BUG, maxHealth: 1, damageToPlayer: 1,
        radius: 5.5, speed: 3, color: '#aa8732',
    },
    [EnemyType.RUNNER]: {
        type: EnemyType.RUNNER, maxHealth: 2, damageToPlayer: 2,
        radius: 20, speed: 2.1, color: '#a34f4c',
    },
    [EnemyType.ARMORED]: {
        type: EnemyType.ARMORED, maxHealth: 10, damageToPlayer: 3,
        radius: 28, speed: .7, color: '#657680', damageReduction: .25,
    },
};
