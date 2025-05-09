import type { Bullet } from '@/entities/bullet/Bullet';

export interface IWeapon {
    damage: number;
    fire(startX: number, startY: number, angle: number): Bullet | Bullet[];
    fireRate: number;
}
