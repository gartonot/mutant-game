import { Bullet } from './Bullet';
export class Flame extends Bullet {
    private age = 0;
    readonly touched = new Set<object>();
    constructor(x: number, y: number, angle: number, speed: number) { super(x, y, angle, 0, speed, 0); this.piercing = true; }
    override update(dt = 1000 / 60) { super.update(dt); this.age += dt; this.radius = 5 + this.age * .04; if (this.age >= 300) this.expired = true; }
    override draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.globalAlpha = .55 * Math.max(0, 1 - this.age / 330); ctx.fillStyle = this.age < 100 ? '#fff2a3' : '#ff6f1f';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
}
