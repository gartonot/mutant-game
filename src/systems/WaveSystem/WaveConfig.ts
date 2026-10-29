import { EnemyType as E } from '@/entities/enemy/EnemyType';

export interface IWaveRule {
    readonly types: readonly E[];
    readonly count: number;
    /** Exact roster; custom rules without this retain random type selection. */
    readonly composition?: readonly E[];
}

export const BOSS_WAVE_INTERVAL = 12;
export const BOSS_SEQUENCE: readonly E[] = [E.BOSS, E.STEROID, E.TENTACLE, E.WORM];
// Six minutes, no spawn on the victory frame.
export const SURVIVAL_WAVE_COUNT = 71;
const pack = (...composition: E[]): IWaveRule => {
    // Bugs arrive with a partner, without increasing the total wave population.
    if (composition.filter(type => type === E.BUG).length === 1) {
        const grunt = composition.lastIndexOf(E.GRUNT);
        if (grunt !== -1) composition[grunt] = E.BUG;
    }
    return { types: [...new Set(composition)], count: composition.length, composition };
};
const grunts = (n: number) => Array<E>(n).fill(E.GRUNT);

// Opening waves sustain pressure with ten enemies, mostly ordinary zombies.
// At 5:00 remaining the field already has
// runners, small bugs, slowers and a fat zombie, alongside the first boss.
const opening: IWaveRule[] = [
    pack(...grunts(10)), pack(...grunts(10)), pack(...grunts(10)),
    pack(...grunts(7), E.BUG, E.BUG, E.BUG),
    pack(...grunts(8), E.BUG, E.BUG),
    pack(...grunts(7), E.BUG, E.BUG, E.TANK),
    pack(...grunts(7), E.BUG, E.BUG, E.SLOWER),
    pack(...grunts(7), E.BUG, E.BUG, E.RUNNER),
    pack(...grunts(7), E.BUG, E.BUG, E.SLOWER),
    pack(...grunts(7), E.RUNNER, E.RUNNER, E.CYAN),
    pack(...grunts(7), E.BUG, E.BUG, E.TANK),
    pack(...grunts(3), E.BUG, E.BUG),
];
const middle: readonly E[][] = [
    [E.BUG, E.BUG, E.RUNNER], [E.GRUNT, E.GRUNT, E.GRUNT],
    [E.BUG, E.SLOWER, E.CYAN], [E.TANK, E.RUNNER, E.BUG],
    [E.ARMORED, E.BUG, E.BUG], [E.BEETLE, E.RUNNER, E.BUG],
    [E.SPITTER, E.BUG, E.RUNNER], [E.JUMPER, E.BUG, E.BUG],
    [E.GRUNT, E.GRUNT, E.SLOWER], [E.TANK, E.CYAN, E.RUNNER],
];
const late: readonly E[][] = [
    [E.BUG, E.BUG, E.BEETLE, E.RUNNER],
    [E.ARMORED, E.GRUNT, E.GRUNT, E.CYAN],
    [E.SPITTER, E.SLOWER, E.BUG, E.BUG],
    [E.JUMPER, E.RUNNER, E.BEETLE, E.BUG],
    [E.TANK, E.ARMORED, E.GRUNT, E.GRUNT],
    [E.BEETLE, E.BEETLE, E.RUNNER, E.CYAN],
    [E.SPITTER, E.BUG, E.BUG, E.ARMORED],
    [E.JUMPER, E.GRUNT, E.GRUNT, E.RUNNER],
    [E.TANK, E.SLOWER, E.CYAN, E.BUG],
    [E.ARMORED, E.BEETLE, E.RUNNER, E.BUG],
];
export const WaveConfigs: readonly IWaveRule[] = Array.from({ length: SURVIVAL_WAVE_COUNT }, (_, index) => {
    if (index < opening.length) return opening[index];
    const phase = index % 12;
    // Light escorts at minute marks and the next wave, even if a boss was delayed.
    if (phase === 11 || phase === 0) return pack(...grunts(3), E.BUG, E.BUG);
    const roles = index < 24 ? middle[phase - 1] : late[phase - 1];
    return pack(...grunts(index < 24 ? 4 : 5), ...roles,
        ...(index >= 48 && phase % 2 === 0 ? [E.BUG, E.BUG] : []));
});
