import { BulletTrail } from '@/effects/BulletTrail';
import type { IGameEntity } from '@entities/interfaces';

export class Bullet implements IGameEntity {
    x: number;
    y: number;
    radius = 4;
    speed: number;
    dx: number;
    dy: number;
    isDead = false;
    damage: number;
    pushBackForce: number;
    private trail: BulletTrail;

    constructor(
        startX: number,
        startY: number,
        angle: number,
        damage: number = 1,
        speed = 10,
        pushBackForce = 5,
    ) {
        // Координаты пули
        this.x = startX;
        this.y = startY;
        // Координаты куда летит пуля
        this.dx = Math.cos(angle);
        this.dy = Math.sin(angle);

        this.damage = damage;
        this.speed = speed;
        this.pushBackForce = pushBackForce;

        this.trail = new BulletTrail(this.x, this.y);
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

        this.trail.update(this.x, this.y);
    }

    draw(ctx: CanvasRenderingContext2D) {
        // Отрисовка хвоста пули
        this.trail.draw(ctx);

        // Отрисовка пули
        this.drawBullet(ctx);
    }

    private drawBullet(ctx: CanvasRenderingContext2D) {
        const length = 13; // длина пули
        const width = 3; // ширина пули

        ctx.save();
        ctx.translate(this.x, this.y);

        // Вычисляем угол вращения на основе направления движения
        const angle = Math.atan2(this.dy, this.dx);
        ctx.rotate(angle);

        // Настройки свечения
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(209, 216, 42, 80%)';

        // Цвет пули
        ctx.fillStyle = '#d1d82a';

        // Рисуем пулю
        ctx.beginPath();
        ctx.moveTo(-length / 2 + width / 2, -width / 2);
        ctx.arcTo(length / 2, -width / 2, length / 2, width / 2, width / 2);
        ctx.arcTo(length / 2, width / 2, -length / 2, width / 2, width / 2);
        ctx.arcTo(-length / 2, width / 2, -length / 2, -width / 2, width / 2);
        ctx.arcTo(-length / 2, -width / 2, length / 2, -width / 2, width / 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}
