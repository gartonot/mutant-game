import { EnemyType } from '@/entities/enemy/EnemyType';

export interface IWaveRule {
    readonly types: readonly EnemyType[];
    readonly count: number;
    /** Exact roster; custom rules without this retain random type selection. */
    readonly composition?: readonly EnemyType[];
}

export const BOSS_WAVE_INTERVAL = 12;
// The world ends at 240s before spawning: ordinary waves run from 5s to 235s.
export const SURVIVAL_WAVE_COUNT = 47;

function mix(grunts: number, bugs = 0, tanks = 0, runners = 0, armored = 0): IWaveRule {
    const composition = [
        ...Array<EnemyType>(grunts).fill(EnemyType.GRUNT),
        ...Array<EnemyType>(bugs).fill(EnemyType.BUG),
        ...Array<EnemyType>(tanks).fill(EnemyType.TANK),
        ...Array<EnemyType>(runners).fill(EnemyType.RUNNER),
        ...Array<EnemyType>(armored).fill(EnemyType.ARMORED),
    ];
    return { types: [...new Set(composition)], count: composition.length, composition };
}

// Each row is five seconds. New roles arrive in small groups before joining mixes.
// Boss escorts and the following wave are deliberately lighter; living enemies remain.
export const WaveConfigs: readonly IWaveRule[] = [
    // 5–60s: learn grunts, bugs (20s), tanks (30s), runners (40s).
    mix(5), mix(6), mix(6), mix(4, 3), mix(5, 2), mix(4, 2, 1),
    mix(5, 3), mix(4, 2, 0, 1), mix(4, 3, 1), mix(5, 2, 0, 1), mix(4, 3, 1), mix(3, 2),
    // 65–120s: recovery, then first armored enemy at 90s.
    mix(3, 2), mix(4, 3, 1), mix(4, 3, 0, 1), mix(4, 3, 1), mix(4, 3, 0, 1), mix(4, 2, 0, 1, 1),
    mix(4, 3, 1), mix(4, 3, 0, 2), mix(4, 3, 1, 0, 1), mix(4, 3, 0, 2), mix(4, 3, 1, 1), mix(3, 2, 0, 1),
    // 125–180s: alternate packs, pursuits and durable front lines.
    mix(3, 2), mix(4, 4, 1), mix(4, 3, 0, 2), mix(4, 3, 1, 0, 1), mix(4, 4, 0, 2), mix(4, 3, 1, 1, 1),
    mix(4, 4, 1), mix(4, 3, 0, 2, 1), mix(4, 4, 1, 1), mix(4, 3, 0, 2, 1), mix(4, 4, 1, 1), mix(3, 3, 0, 1),
    // 185–235s: recovery, then a capped final push; no fourth boss at victory.
    mix(3, 3), mix(4, 4, 1, 1), mix(4, 4, 0, 2, 1), mix(4, 3, 1, 1, 1), mix(4, 4, 0, 2, 1), mix(4, 4, 1, 1, 1),
    mix(4, 4, 0, 2, 1), mix(4, 3, 1, 1, 2), mix(4, 4, 0, 2, 1), mix(4, 4, 1, 1, 1), mix(4, 4, 0, 2, 1),
];
