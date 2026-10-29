import { EnemyType } from '@entities/enemy/EnemyType.ts';
import type { IEnemyConfig } from '@entities/interfaces';

// One tuning knob preserves relative movement speeds across the whole roster.
export const ENEMY_MOVEMENT_SCALE = .85;
// Provisional combat values. Reference shots use the unupgraded pistol (1) and rifle (2.5).
export const ENEMY_CONFIGS: Record<EnemyType, IEnemyConfig> = {
    [EnemyType.GRUNT]: { type: EnemyType.GRUNT, maxHealth: 2, damageToPlayer: 2, radius: 25, speed: 1, color: '#756e44' },
    [EnemyType.TANK]: { type: EnemyType.TANK, maxHealth: 20, damageToPlayer: 3, radius: 35, speed: .65, color: '#416b20' },
    // Roughly the 20px aim ring, with a little margin for the insect's narrow body.
    [EnemyType.BUG]: { type: EnemyType.BUG, maxHealth: 1, damageToPlayer: 1, radius: 13, speed: 3, color: '#88b827' },
    [EnemyType.RUNNER]: { type: EnemyType.RUNNER, maxHealth: 2, damageToPlayer: 2, radius: 25, speed: 2.1, color: '#a34f4c' },
    [EnemyType.ARMORED]: { type: EnemyType.ARMORED, maxHealth: 10, damageToPlayer: 3, radius: 28, speed: .7, color: '#314326', damageReduction: .25 },
    [EnemyType.SLOWER]: { type: EnemyType.SLOWER, maxHealth: 2, damageToPlayer: 1, radius: 25, speed: 1.05, color: '#8daa35' },
    [EnemyType.CYAN]: { type: EnemyType.CYAN, maxHealth: 3, damageToPlayer: 2, radius: 25, speed: 1.1, color: '#269487' },
    [EnemyType.LEECH]: { type: EnemyType.LEECH, maxHealth: 1, damageToPlayer: .5, radius: 6, speed: 2.65, color: '#a1c6b7' },
    [EnemyType.BEETLE]: { type: EnemyType.BEETLE, maxHealth: 7.5, damageToPlayer: 2, radius: 19, speed: 2.8, color: '#5c7848' },
    [EnemyType.SPITTER]: { type: EnemyType.SPITTER, maxHealth: 7.5, damageToPlayer: 2, radius: 25, speed: .85, color: '#739c32' },
    [EnemyType.JUMPER]: { type: EnemyType.JUMPER, maxHealth: 3, damageToPlayer: 3, radius: 15, speed: 1.6, color: '#81b92b' },
    [EnemyType.BOSS]: { type: EnemyType.BOSS, maxHealth: 20, damageToPlayer: 5, radius: 48, speed: 1, color: '#68774a' },
    [EnemyType.STEROID]: { type: EnemyType.STEROID, maxHealth: 210, damageToPlayer: 6, radius: 52, speed: 2.8, color: '#6b864b' },
    [EnemyType.TENTACLE]: { type: EnemyType.TENTACLE, maxHealth: 240, damageToPlayer: 5, radius: 55, speed: .85, color: '#995933' },
    [EnemyType.WORM]: { type: EnemyType.WORM, maxHealth: 260, damageToPlayer: 5, radius: 48, speed: .4, color: '#9c5148' },
};

for (const config of Object.values(ENEMY_CONFIGS)) config.speed *= ENEMY_MOVEMENT_SCALE;
