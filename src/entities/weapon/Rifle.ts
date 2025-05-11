import { Gun } from '@entities/weapon/Gun.ts';

export class Rifle extends Gun {
    constructor() {
        super('Автомат', {
            damage: 2.5,
            fireRate: 300,
            speed: 10,
            pushBackForce: 17,
        });
    }
}
