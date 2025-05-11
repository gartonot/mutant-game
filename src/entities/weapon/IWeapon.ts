import type { Bullet } from '@/entities/bullet/Bullet';

export interface IWeapon {
    name: string; // название
    damage: number; // урон
    fireRate: number; // частота выстрелов
    pushBackForce: number; // сила отталкивания
    fire(startX: number, startY: number, angle: number): Bullet | Bullet[];
}
