import { Bullet } from '@entities/bullet/Bullet.ts';
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

    public fire(startX: number, startY: number, angle: number):Bullet | Bullet[] {
        return new Bullet(
            startX,
            startY,
            angle,
            this.damage,
            this.speed,
            this.pushBackForce,
        );
    }
}
