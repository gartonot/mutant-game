import type { IUpdatable, IDrawable } from '@entities/interfaces/interfaces';

export class Player implements IUpdatable, IDrawable {
    x = 100;
    y = 100;
    speed = 5;
    radius = 20;

    constructor(x = 100, y = 100) {
        this.x = x;
        this.y = y;
    }

    update() {
    }

    // Отрисовка персонажа
    draw(ctx: CanvasRenderingContext2D) {
        // Рисуем игрока
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}
