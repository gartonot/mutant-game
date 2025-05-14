import { Bullet } from '@entities/bullet/Bullet.ts';
import { Gun } from '@entities/weapon/Gun.ts';

export class Shotgun extends Gun {
    constructor() {
        // При добавлении параметров, которые влияют на пули, добавлять их в fire() метод ниже
        super('Дробовик', {
            damage: 5,
            fireRate: 1000,
        });

    }

    public fire(
        startX: number,
        startY: number,
        angle: number,
        onFireVisualEffect?: (x: number, y: number, angle: number) => void,
    ): Bullet[] {
        if (onFireVisualEffect) {
            const muzzleOffset = 32;
            const fx = startX + Math.cos(angle) * muzzleOffset;
            const fy = startY + Math.sin(angle) * muzzleOffset;
            onFireVisualEffect(fx, fy, angle);
        }

        const spreadAngle = 0.04; // Разброс пуль (радианы)
        const speed = 40;
        const pushBackForce = 35;

        return [
            new Bullet(startX, startY, angle - spreadAngle * 1.5, this.damage * 0.5, speed, pushBackForce),
            new Bullet(startX, startY, angle - spreadAngle * 0.5, this.damage, speed, pushBackForce),
            new Bullet(startX, startY, angle + spreadAngle * 0.5, this.damage, speed, pushBackForce),
            new Bullet(startX, startY, angle + spreadAngle * 1.5, this.damage * 0.5, speed, pushBackForce),
        ];
    }
}
