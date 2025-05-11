import { Bullet } from '@entities/bullet/Bullet.ts';
import { Gun } from '@entities/weapon/Gun.ts';

export class Shotgun extends Gun {
    constructor() {
        super('Дробовик', {
            damage: 5,
            fireRate: 1000,
            pushBackForce: 25,
        });

    }

    public fire(startX: number, startY: number, angle: number): Bullet[] {
        const spreadAngle = 0.04; // Разброс пуль (радианы)
        const speed = 40;
        return [
            new Bullet(startX, startY, angle - spreadAngle * 1.5, this.damage * 0.5, speed),
            new Bullet(startX, startY, angle - spreadAngle * 0.5, this.damage, speed),
            new Bullet(startX, startY, angle + spreadAngle * 0.5, this.damage, speed),
            new Bullet(startX, startY, angle + spreadAngle * 1.5, this.damage * 0.5, speed),
        ];
    }
}
