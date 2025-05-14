import type { Bullet } from '@/entities/bullet/Bullet';

export interface IWeapon {
    name: string; // название
    damage: number; // урон
    fireRate: number; // частота выстрелов
    pushBackForce: number; // сила отталкивания
    lastShotTime?: number; // время последнего выстрела
    fire(startX: number, startY: number, angle: number, onVisualEffect?: (x: number, y: number, angle: number) => void): Bullet | Bullet[];
}
