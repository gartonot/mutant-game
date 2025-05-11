import { EnemyType } from '@/entities/enemy/EnemyType';

export interface IWaveRule {
    types: EnemyType[];
    count: number;
}

export const WaveConfigs: IWaveRule[] = [
    { types: [EnemyType.GRUNT], count: 2 }, // Волна 1: 2 обычных
    { types: [EnemyType.GRUNT], count: 4 }, // Волна 2: 4 обычных
    { types: [EnemyType.TANK], count: 2 }, // Волна 3: 2 танка
    { types: [EnemyType.GRUNT, EnemyType.TANK], count: 7 }, // Волна 4: 5 обычных + 2 танка
];
