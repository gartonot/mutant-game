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

    protected override getProjectiles(startX: number, startY: number, angle: number): Bullet[] {
        const spreadAngle = 0.04;
        const defaultConfig = {
            speed: 40,
            pushBackForce: 35,
        };
        const configs = [
            { angleOffset: -spreadAngle * 1.5, damageMultiplier: 0.5 },
            { angleOffset: -spreadAngle * 0.5, damageMultiplier: 1.0 },
            { angleOffset:  spreadAngle * 0.5, damageMultiplier: 1.0 },
            { angleOffset:  spreadAngle * 1.5, damageMultiplier: 0.5 },
        ] as const;

        const shotgunConfigBullets = configs.map(config => ({
            ...defaultConfig,
            ...config,
        }));

        return this.createBulletsFromConfig(startX, startY, angle, shotgunConfigBullets);
    }
}
