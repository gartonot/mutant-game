import type { HitEffect } from '@/gameplay/HitEffect';
import { drawBulletSprite } from '@/rendering/BulletSprite';
import { BulletTrail } from '@/effects/BulletTrail';
import type { IGameEntity } from '@entities/interfaces';

export class Bullet implements IGameEntity {
    x: number;
    y: number;
    previousX: number;
    previousY: number;
    effect?: HitEffect;
    piercing = false;
    collisionResolved = false;
    expired = false;
    hitRegistered = false;
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
        this.previousX = startX;
        this.previousY = startY;
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

    update(_deltaMs = 1000 / 60) {
        this.previousX = this.x;
        this.previousY = this.y;
        this.x += this.dx * this.speed;
        this.y += this.dy * this.speed;

        // Удаляем пулю, если она улетела за экран
        if (
            this.x < 0 || this.x > window.innerWidth ||
            this.y < 0 || this.y > window.innerHeight
        ) {
            this.expired = true;
        }

        this.trail.update(this.x, this.y);
    }

    draw(ctx: CanvasRenderingContext2D) {
        // Отрисовка хвоста пули
        this.trail.draw(ctx);

        // Отрисовка пули
        if (this.effect?.slowMs) {
            ctx.save(); ctx.fillStyle = '#d5fbff'; ctx.shadowColor = '#69c9ff'; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        } else this.drawBullet(ctx);
    }

    private drawBullet(ctx: CanvasRenderingContext2D) {
        drawBulletSprite(ctx, this.x, this.y, Math.atan2(this.dy, this.dx));
    }
}
