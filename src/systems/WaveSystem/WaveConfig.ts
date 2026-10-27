import { EnemyType } from '@/entities/enemy/EnemyType';

export interface IWaveRule {
    readonly types: readonly EnemyType[];
    readonly count: number;
}

export const WaveConfigs: readonly IWaveRule[] = [
    { types: [EnemyType.GRUNT], count: 5 }, // Волна 1: 5 обычных
    { types: [EnemyType.GRUNT], count: 10 }, // Волна 2: 10 обычных
    { types: [EnemyType.TANK], count: 4 }, // Волна 3: 4 танка
    { types: [EnemyType.GRUNT, EnemyType.TANK], count: 7 }, // Волна 4: 5 обычных + 2 танка
];
