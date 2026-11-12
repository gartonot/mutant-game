export const enum EnemyType {
    GRUNT = 'grunt', TANK = 'tank', BUG = 'bug', RUNNER = 'runner', ARMORED = 'armored',
    SLOWER = 'slower', CYAN = 'cyan', LEECH = 'leech', BEETLE = 'beetle',
    SPITTER = 'spitter', JUMPER = 'jumper',
    BOSS = 'boss', STEROID = 'steroid', TENTACLE = 'tentacle', WORM = 'worm',
}

export function isBossType(type: EnemyType): boolean {
    return type === EnemyType.BOSS || type === EnemyType.STEROID
        || type === EnemyType.TENTACLE || type === EnemyType.WORM;
}

export function isZombieType(type: EnemyType): boolean {
    return type === EnemyType.GRUNT || type === EnemyType.RUNNER || type === EnemyType.ARMORED
        || type === EnemyType.SLOWER || type === EnemyType.CYAN || type === EnemyType.TANK;
}
