import type { CharacterId } from '@/gameplay/ids';
import type { WeaponId } from '@/gameplay/ids';

export class Player {
    x;
    y;
    speed = 5;
    radius = 20;
    character: CharacterId = 'mercenary';
    weapon: WeaponId = 'pistol';
    angle = 0;
    recoil = 0;

    // Здоровье игрока
    maxHp = 100;
    currentHp = 100;
    damageTaken = 0;

    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    takeDamage(amount: number) {
        this.damageTaken += Math.min(this.currentHp, Math.max(0, amount));
        this.currentHp -= amount;
        if (this.currentHp <= 0) {
            this.currentHp = 0;
            console.log('💀 Game Over');
        }
    }

    heal(amount: number) {
        this.currentHp += amount;
        if (this.currentHp > this.maxHp) {
            this.currentHp = this.maxHp;
        }
    }
}
