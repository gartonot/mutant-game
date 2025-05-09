import { distance } from '@/utils/math';
import type { IDrawable, IUpdatable } from '@entities/interfaces/interfaces';

export class Enemy implements IUpdatable, IDrawable {
    x: number;
    y: number;
    radius = 15;
    speed = 2;
    isDead = false;
    private targetX = 0;
    private targetY = 0;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    update() {
        const angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    setTarget(x: number, y: number) {
        this.targetX = x;
        this.targetY = y;
    }

    checkCollision(bulletX: number, bulletY: number, bulletRadius: number) {
        return distance(this.x, this.y, bulletX, bulletY) < this.radius + bulletRadius;
    }
}

