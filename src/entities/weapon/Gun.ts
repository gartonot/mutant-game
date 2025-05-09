import { Bullet } from '@entities/bullet/Bullet.ts';
import type { IWeapon } from '@entities/weapon/IWeapon.ts';

interface IProps {
    damage: number;
    fireRate: number;
}

export class Gun implements IWeapon {
    public damage: number;
    public fireRate: number;

    constructor({ damage, fireRate }: IProps) {
        this.damage = damage;
        this.fireRate = fireRate;
    }

    public fire(startX: number, startY: number, angle: number):Bullet | Bullet[] {
        return new Bullet(startX, startY, angle, this.damage);
    }
}
