import { Gun } from '@entities/weapon/Gun.ts';

export class Pistol extends Gun {
    constructor() {
        super({
            damage: 1,
            fireRate: 500,
        });
    }
}
