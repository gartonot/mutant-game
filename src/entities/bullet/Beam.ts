import { drawPlasmaBeam } from '@/rendering/PlasmaEffects';
import { segmentHit } from '@/systems/spatial/segmentHit';
import { Bullet } from './Bullet';
/** Plasma is a single pulse; a paid laser pulse can track aim without hitting a target twice. */
export class Beam extends Bullet {
    private age = 0;
    lifetimeMs: number;
    readonly touched = new Set<object>();
    sweepStartX: number;
    sweepStartY: number;
    sweepEndX: number;
    sweepEndY: number;
    constructor(x: number, y: number, angle: number, damage: number, push: number, readonly plasma: boolean) {
        super(x, y, angle, damage, 0, push);
        this.piercing = true;
        this.lifetimeMs = plasma ? 180 : 80;
        this.radius = plasma ? 22 : 7;
        this.setRay(x, y, angle);
        this.sweepStartX = x; this.sweepStartY = y; this.sweepEndX = this.x; this.sweepEndY = this.y;
    }
    private setRay(x: number, y: number, angle: number): void {
        this.previousX = x; this.previousY = y; this.x = x; this.y = y;
        this.dx = Math.cos(angle); this.dy = Math.sin(angle);
        const width = typeof window === 'undefined' ? 1920 : window.innerWidth;
        const height = typeof window === 'undefined' ? 1080 : window.innerHeight;
        const tx = this.dx > 0 ? (width - x) / this.dx : this.dx < 0 ? -x / this.dx : Infinity;
        const ty = this.dy > 0 ? (height - y) / this.dy : this.dy < 0 ? -y / this.dy : Infinity;
        const length = Math.max(0, Math.min(tx, ty));
        this.x += this.dx * length; this.y += this.dy * length;
    }
    inheritSweep(previous: Beam): void {
        this.sweepStartX = previous.previousX; this.sweepStartY = previous.previousY;
        this.sweepEndX = previous.x; this.sweepEndY = previous.y;
    }
    aim(x: number, y: number, angle: number): void {
        this.inheritSweep(this); this.setRay(x, y, angle); this.collisionResolved = false;
    }
    intersects(cx: number, cy: number, radius: number): boolean {
        if (segmentHit(this.previousX, this.previousY, this.x, this.y, cx, cy, radius) !== null) return true;
        if (this.plasma) return false;
        return triangleCircle(this.sweepStartX, this.sweepStartY, this.sweepEndX, this.sweepEndY,
            this.x, this.y, cx, cy, radius) || triangleCircle(this.sweepStartX, this.sweepStartY,
            this.x, this.y, this.previousX, this.previousY, cx, cy, radius);
    }
    override update(dt = 1000 / 60) { this.age += dt; this.expired = this.age > this.lifetimeMs; }
    override draw(ctx: CanvasRenderingContext2D) {
        if (this.plasma) { drawPlasmaBeam(ctx, this.previousX, this.previousY, this.x, this.y, this.age); return; }
        ctx.save();
        ctx.lineCap = 'round';
        for (const [width, color] of [[26, '#ff202035'], [14, '#ff4747'], [4, '#fff1ed']] as [number, string][]) {
            ctx.lineWidth = width; ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(this.previousX, this.previousY); ctx.lineTo(this.x, this.y); ctx.stroke();
        }
        ctx.restore();
    }
}

/** Swept quadrilateral is split into triangles; disk edges include the beam's width. */
function triangleCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number,
    x: number, y: number, radius: number): boolean {
    const area = (bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
    if (Math.abs(area) > 1e-8) {
        const a = (bx-ax)*(y-ay)-(by-ay)*(x-ax);
        const b = (cx-bx)*(y-by)-(cy-by)*(x-bx);
        const c = (ax-cx)*(y-cy)-(ay-cy)*(x-cx);
        if ((a >= 0 && b >= 0 && c >= 0) || (a <= 0 && b <= 0 && c <= 0)) return true;
    }
    return segmentHit(ax,ay,bx,by,x,y,radius) !== null || segmentHit(bx,by,cx,cy,x,y,radius) !== null ||
        segmentHit(cx,cy,ax,ay,x,y,radius) !== null;
}
