import type { IGameEntity } from '@entities/interfaces';

export class Player implements IGameEntity {
    x;
    y;
    speed = 5;
    radius = 20;

    // Здоровье игрока
    maxHp = 100;
    currentHp = 100;

    constructor(x = window.innerWidth / 2, y = window.innerHeight / 2) {
        this.x = x;
        this.y = y;
    }

    update() {}

    // Отрисовка персонажа
    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    takeDamage(amount: number) {
        this.currentHp -= amount;
        if (this.currentHp <= 0) {
            this.currentHp = 0;
            console.log('💀 Game Over');
        }
    }

    heal(amount: number) {
        this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
    }
}
