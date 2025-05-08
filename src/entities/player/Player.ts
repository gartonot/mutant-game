import type { IUpdatable, IDrawable } from '@entities/interfaces/interfaces';

export class Player implements IUpdatable, IDrawable {
    x = 100;
    y = 100;
    speed = 5;
    radius = 20;

    keys: Set<string> = new Set();

    constructor() {
        // Подписываемся на событие нажатия клавиш
        window.addEventListener('keydown', e => this.keys.add(e.key));
        // Подписываемся на событие отжатия клавиш
        window.addEventListener('keyup', e => this.keys.delete(e.key));
    }

    update = (): void => {
        this.handleMovement();
    };

    // Отрисовка персонажа
    draw = (ctx: CanvasRenderingContext2D): void => {
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    };


    // Логика игрока
    handleMovement = (): void => {
        if (this.keys.has('w')) this.y -= this.speed;
        if (this.keys.has('s')) this.y += this.speed;
        if (this.keys.has('a')) this.x -= this.speed;
        if (this.keys.has('d')) this.x += this.speed;
    };
}
