import type { HitEffect } from '@/gameplay/HitEffect';
import { drawBulletSprite } from '@/rendering/BulletSprite';
import { BulletTrail } from '@/effects/BulletTrail';
import type { IGameEntity } from '@entities/interfaces';
import { getArenaSize } from '@/gameplay/Arena';

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
        startY = Math.min(startY, getArenaSize().height);
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
        if (this.moveWithinArena(this.speed)) this.expired = true;
        this.trail.update(this.x, this.y);
    }

    /** Keep the last swept segment so a target at the boundary can still be hit. */
    protected moveWithinArena(distance: number): boolean {
        const { width, height } = getArenaSize();
        this.y = Math.min(this.y, height);
        this.previousX = this.x;
        this.previousY = this.y;
        const tx = this.dx > 0 ? (width - this.x) / this.dx : this.dx < 0 ? -this.x / this.dx : Infinity;
        const ty = this.dy > 0 ? (height - this.y) / this.dy : this.dy < 0 ? -this.y / this.dy : Infinity;
        const limit = Math.max(0, Math.min(tx, ty));
        const travel = Math.min(distance, limit);
        this.x += this.dx * travel;
        this.y += this.dy * travel;
        return distance >= limit;
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
