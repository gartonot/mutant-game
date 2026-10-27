import { Bullet } from './Bullet';

export class Bolt extends Bullet {
    override draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(Math.atan2(this.dy, this.dx));
        ctx.strokeStyle = '#dce5d3'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = '#aac5c9'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(0, -4); ctx.lineTo(0, 4); ctx.fill();
        ctx.strokeStyle = '#72944c'; ctx.beginPath(); ctx.moveTo(-18, -5); ctx.lineTo(-12, 0); ctx.lineTo(-18, 5); ctx.stroke(); ctx.restore();
    }
}

export class AcidGlob extends Bullet {
    override draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.fillStyle = '#a9ff5e'; ctx.shadowColor = '#50ed32'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.ellipse(this.x, this.y, 9, 5, Math.atan2(this.dy, this.dx), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
}

export class Disc extends Bullet {
    readonly touched = new Set<object>();
    readonly maxTargets = 3;
    private rotation = 0;
    constructor(x: number, y: number, angle: number, damage: number, speed: number, push: number) {
        super(x, y, angle, damage, speed, push); this.piercing = true; this.radius = 12;
    }
    override update(dt = 1000 / 60) { super.update(dt); this.rotation += dt * .025; }
    override draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rotation);
        ctx.fillStyle = '#d6e3df'; ctx.strokeStyle = '#516462'; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < 24; i++) {
            const angle = i * Math.PI / 12, radius = i % 2 ? 9 : 13;
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#dc843b';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
}

/** A short electric fan, resolved once and retained briefly for its visual flash. */
export class Pulse extends Bullet {
    readonly reach = 165;
    readonly halfAngle = .65;
    private age = 0;
    constructor(x: number, y: number, angle: number, damage: number, push: number) {
        super(x, y, angle, damage, 0, push); this.piercing = true; this.radius = 0;
    }
    intersects(x: number, y: number, radius: number): boolean {
        const rx = x - this.x, ry = y - this.y;
        const forward = rx * this.dx + ry * this.dy, side = Math.abs(-rx * this.dy + ry * this.dx);
        if (forward < 0) return false;
        if (Math.atan2(side, forward) <= this.halfAngle) return Math.hypot(forward, side) <= this.reach + radius;
        // Distance to the closest edge segment also accounts for enemies overlapping the fan edge.
        const cosine = Math.cos(this.halfAngle), sine = Math.sin(this.halfAngle);
        const t = Math.max(0, Math.min(this.reach, forward * cosine + side * sine));
        return Math.hypot(forward - t * cosine, side - t * sine) <= radius;
    }
    override update(dt = 1000 / 60) { this.age += dt; this.expired = this.age >= 180; }
    override draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(Math.atan2(this.dy, this.dx));
        ctx.globalAlpha = Math.pow(Math.max(0, 1 - this.age / 180), .65);
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, this.reach);
        haze.addColorStop(0, '#c9f5ff88'); haze.addColorStop(.3, '#4fbaff33'); haze.addColorStop(1, '#3183ff00');
        ctx.fillStyle = haze; ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.reach, -this.halfAngle, this.halfAngle); ctx.closePath(); ctx.fill();
        const arcs = new Path2D(), forks = new Path2D(), phase = Math.floor(this.age / 40);
        for (let ray = 0; ray < 9; ray++) {
            const angle = -this.halfAngle + ray / 8 * this.halfAngle * 2;
            const length = this.reach * (ray % 2 ? .86 : 1);
            arcs.moveTo(0, 0);
            for (let step = 1; step <= 8; step++) {
                const t = step / 8, noise = Math.sin(ray * 19.17 + step * 12.9898 + phase * 3.17) * 43758.5453;
                const offset = step === 8 ? 0 : (noise - Math.floor(noise) - .5) * .13;
                const direction = Math.max(-this.halfAngle, Math.min(this.halfAngle, angle + offset));
                const x = Math.cos(direction) * length * t, y = Math.sin(direction) * length * t;
                arcs.lineTo(x, y);
                if (step === 4 || step === 6) {
                    const branchAngle = Math.max(-this.halfAngle, Math.min(this.halfAngle, direction + (ray % 2 ? .16 : -.16)));
                    forks.moveTo(x, y);
                    forks.lineTo(Math.cos(branchAngle) * (length * t + 10), Math.sin(branchAngle) * (length * t + 10));
                    forks.lineTo(Math.cos(branchAngle + .03) * (length * t + 23), Math.sin(branchAngle + .03) * (length * t + 23));
                }
            }
        }
        ctx.shadowColor = '#328bff'; ctx.shadowBlur = 16; ctx.strokeStyle = '#399bff77'; ctx.lineWidth = 7; ctx.stroke(arcs);
        ctx.shadowBlur = 9; ctx.strokeStyle = '#73d7ff'; ctx.lineWidth = 3; ctx.stroke(arcs);
        ctx.lineWidth = 1.3; ctx.stroke(forks);
        ctx.shadowBlur = 3; ctx.strokeStyle = '#effeff'; ctx.lineWidth = 1.1; ctx.stroke(arcs);
        ctx.restore();
    }
}

export class ChainLightning extends Bullet {
    readonly jumpRange = 200;
    readonly maxJumps = 3;
    readonly falloff = .7;
    readonly arcs: { x: number; y: number }[] = [];
    private flashAge = 0;
    constructor(x: number, y: number, angle: number, damage: number, _speed: number, push: number) {
        super(x, y, angle, damage, 0, push);
        this.moveWithinArena(480);
    }
    override update(dt = 1000 / 60) {
        this.flashAge += dt; this.expired = this.flashAge >= 180;
    }
    override draw(ctx: CanvasRenderingContext2D) {
        const points = this.arcs.length ? this.arcs : [{ x: this.previousX, y: this.previousY }, { x: this.x, y: this.y }];
        const bolt = new Path2D(), branches = new Path2D();
        const phase = Math.floor(this.flashAge / 45);
        // Cosmetic jitter is deterministic and never consumes the game's random sequence.
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1], b = points[i];
            const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
            if (length < .01) continue;
            const nx = -dy / length, ny = dx / length;
            const steps = Math.max(3, Math.min(30, Math.ceil(length / 18)));
            bolt.moveTo(a.x, a.y);
            for (let j = 1; j <= steps; j++) {
                const t = j / steps;
                const noise = Math.sin(j * 12.9898 + i * 7.23 + phase * 3.17) * 43758.5453;
                const jitter = j === steps ? 0 : ((noise - Math.floor(noise)) * 2 - 1) * Math.min(13, length * .13);
                const x = a.x + dx * t + nx * jitter, y = a.y + dy * t + ny * jitter;
                bolt.lineTo(x, y);
                if (j % 5 === 2 && j < steps - 1) {
                    const side = j % 2 ? 1 : -1;
                    branches.moveTo(x, y);
                    branches.lineTo(x + dx / length * 10 + nx * side * 13, y + dy / length * 10 + ny * side * 13);
                    branches.lineTo(x + dx / length * 23 + nx * side * 9, y + dy / length * 23 + ny * side * 9);
                    branches.lineTo(x + dx / length * 28 + nx * side * 23, y + dy / length * 28 + ny * side * 23);
                }
            }
        }
        ctx.save();
        ctx.globalAlpha = Math.pow(Math.max(0, 1 - this.flashAge / 180), .65);
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowColor = '#348bff'; ctx.shadowBlur = 26;
        ctx.strokeStyle = '#2869ff55'; ctx.lineWidth = 13; ctx.stroke(bolt);
        ctx.shadowBlur = 16; ctx.strokeStyle = '#57caffbb'; ctx.lineWidth = 6; ctx.stroke(bolt);
        ctx.lineWidth = 2; ctx.stroke(branches);
        ctx.shadowBlur = 7; ctx.strokeStyle = '#f0fdff'; ctx.lineWidth = 2.2; ctx.stroke(bolt);
        ctx.strokeStyle = '#c5efff'; ctx.lineWidth = .8; ctx.stroke(branches);
        for (const point of points) {
            const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 18);
            glow.addColorStop(0, '#e8fbffcc'); glow.addColorStop(.2, '#71cfff88'); glow.addColorStop(1, '#287bff00');
            ctx.fillStyle = glow; ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.arc(point.x, point.y, 18, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}
