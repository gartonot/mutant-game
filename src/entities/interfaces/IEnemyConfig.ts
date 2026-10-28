export interface IEnemyConfig {
    type: string;
    maxHealth: number;
    damageToPlayer: number;
    radius: number;
    speed: number;
    color: string;
    damageReduction?: number;
}
