import { Bullet } from '@entities/bullet/Bullet.ts';
import { Gun } from '@entities/weapon/Gun.ts';

export class Shotgun extends Gun {
    constructor() {
        super('Дробовик', {
            damage: 5,
            fireRate: 1000,
        });

    }

    public fire(startX: number, startY: number, angle: number): Bullet[] {
        const spreadAngle = 0.1; // Разброс пуль (радианы)
        const speed = 20;

        return [
            new Bullet(startX, startY, angle - spreadAngle, this.damage, speed),
            new Bullet(startX, startY, angle, this.damage, speed),
            new Bullet(startX, startY, angle + spreadAngle, this.damage, speed),
        ];
    }
}
