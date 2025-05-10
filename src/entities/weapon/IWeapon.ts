import type { Bullet } from '@/entities/bullet/Bullet';

export interface IWeapon {
    name: string;
    damage: number;
    fireRate: number;
    fire(startX: number, startY: number, angle: number): Bullet | Bullet[];
}
