import type { IDrawable, IUpdatable } from '@entities/interfaces/interfaces.ts';

export class Bullet implements IUpdatable, IDrawable {
    x: number;
    y: number;
    radius = 4;
    speed = 10;
    dx: number;
    dy: number;
    isDead = false;

    constructor(startX: number, startY: number, angle: number) {
        // Координаты пули
        this.x = startX;
        this.y = startY;
        // Координаты куда летит пуля
        this.dx = Math.cos(angle);
        this.dy = Math.sin(angle);
    }

    update() {
        this.x += this.dx * this.speed;
        this.y += this.dy * this.speed;

        // Удаляем пулю, если она улетела за экран
        if (
            this.x < 0 || this.x > window.innerWidth ||
            this.y < 0 || this.y > window.innerHeight
        ) {
            this.isDead = true;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}
