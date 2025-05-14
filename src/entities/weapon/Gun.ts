import { Bullet } from '@entities/bullet/Bullet.ts';
import type { IBulletConfig } from '@entities/weapon/IBulletConfig.ts';
import type { IWeapon } from '@entities/weapon/IWeapon.ts';

interface IProps {
    damage: number;
    fireRate: number;
    speed?: number;
    pushBackForce?: number;
}

const DEFAULT_SPEED = 10;

export class Gun implements IWeapon {
    public name: string;
    public damage: number;
    public fireRate: number;
    public speed: number;
    public pushBackForce: number;

    constructor(name: string, props: IProps) {
        this.name = name;
        this.damage = props.damage;
        this.fireRate = props.fireRate;
        this.speed = props.speed ?? DEFAULT_SPEED;
        this.pushBackForce = props.pushBackForce ?? 10;
    }

    public fire(
        startX: number,
        startY: number,
        angle: number,
        onFireVisualEffect?: (x: number, y: number, angle: number) => void,
    ): Bullet | Bullet[] {
        const muzzleOffset = 32;
        const fx = startX + Math.cos(angle) * muzzleOffset;
        const fy = startY + Math.sin(angle) * muzzleOffset;

        if (onFireVisualEffect) {
            onFireVisualEffect(fx, fy, angle);
        }

        return this.getProjectiles(startX, startY, angle);
    }


    protected getProjectiles(startX: number, startY: number, angle: number): Bullet | Bullet[] {
        return this.createBulletsFromConfig(startX, startY, angle, [
            { angleOffset: 0 },
        ]);
    }

    protected createBulletsFromConfig(
        startX: number,
        startY: number,
        baseAngle: number,
        configs: IBulletConfig[],
    ): Bullet[] {
        return configs.map(config => {
            const angle = baseAngle + config.angleOffset;
            const damage = this.damage * (config.damageMultiplier ?? 1);
            const speed = config.speed ?? this.speed;
            const pushBackForce = config.pushBackForce ?? this.pushBackForce;

            return new Bullet(startX, startY, angle, damage, speed, pushBackForce);
        });
    }
}
