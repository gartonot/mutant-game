import { Bullet } from './Bullet';

export class Grenade extends Bullet {
    readonly blastRadius: number;
    detonated = false;
    private distance = 0;
    private elapsed = 0;

    constructor(x: number, y: number, angle: number, damage: number, speed: number, pushBackForce: number, readonly variant: 'normal' | 'skull' | 'plasma' = 'normal', explosionRadius = 1) {
        super(x, y, angle, damage, speed, pushBackForce);
        this.blastRadius = 95 * explosionRadius;
        this.radius = 6;
    }

    override update(deltaMs = 1000 / 60) {
        this.elapsed += deltaMs;
        this.previousX = this.x;
        this.previousY = this.y;
        if (this.detonated) return;
        const hitBoundary = this.moveWithinArena(this.speed);
        this.distance += this.speed;
        if (this.distance >= 440 || this.elapsed >= 1600 || hitBoundary) this.detonated = true;
    }

    override draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(Math.atan2(this.dy, this.dx));
        if (this.variant !== 'normal') {
            ctx.fillStyle = this.variant === 'plasma' ? '#f4ffff' : '#d9dac7'; ctx.shadowColor = '#b7f4ff'; ctx.shadowBlur = 14;
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
            if (this.variant === 'skull') { ctx.fillStyle = '#292920'; ctx.fillRect(1, -5, 3, 3); ctx.fillRect(1, 2, 3, 3); }
            ctx.restore(); return;
        }
        ctx.fillStyle = '#e8b954'; ctx.shadowColor = '#f8a52e'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.roundRect(-8, -4, 16, 8, 3); ctx.fill();
        ctx.fillStyle = '#607656'; ctx.fillRect(-6, -4, 9, 8);
        ctx.restore();
    }
}
