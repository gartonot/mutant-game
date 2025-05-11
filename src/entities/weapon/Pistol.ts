import { Gun } from '@entities/weapon/Gun.ts';

export class Pistol extends Gun {
    constructor() {
        super('Пистолет', {
            damage: 1,
            fireRate: 600,
            speed: 10,
            pushBackForce: 20,
        });
    }
}
