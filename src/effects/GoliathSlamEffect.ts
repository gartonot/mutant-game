interface GroundPoint { x: number; y: number }
interface GroundCrack { points: GroundPoint[]; width: number }
interface EarthParticle {
    x: number; y: number; size: number; lift: number; life: number; tone: number;
}

/** A dusty ground impact and a lingering scar, driven entirely by simulation time. */
export class GoliathSlamEffect {
    private ageMs = 0;
    private readonly durationMs = 12000;
    private readonly cracks: GroundCrack[] = [];
    private readonly grains: EarthParticle[] = [];
    private imprint: HTMLCanvasElement | null = null;

    constructor(public readonly x: number, public readonly y: number,
        private readonly angle: number, private readonly radius = 220) {
        let seed = (Math.round(x * 19) ^ Math.round(y * 73) ^ 0x6011a7) >>> 0;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let i = 0; i < 13; i++) {
            const direction = angle + i * 2.399963 + random() * .6;
            const length = radius * (.3 + random() * .56);
            const origin = { x: Math.cos(angle) * 24 + (random() - .5) * 26,
                y: Math.sin(angle) * 24 + (random() - .5) * 26 };
            const points: GroundPoint[] = [origin];
            for (let step = 1; step <= 12; step++) {
                const distance = length * step / 12;
                const bend = Math.sin(step * .7 + i) * 5 + (random() - .5) * 9;
                points.push({ x: origin.x + Math.cos(direction) * distance - Math.sin(direction) * bend,
                    y: origin.y + Math.sin(direction) * distance + Math.cos(direction) * bend });
            }
            this.cracks.push({ points, width: .65 + random() * 1.1 });
            for (let fork = 0; fork < 2; fork++) {
                const root = points[4 + fork * 3];
                const forkAngle = direction + (fork ? -.6 : .7);
                const branch = [root];
                for (let step = 1; step <= 4; step++) {
                    const reach = step * (5 + random() * 5);
                    branch.push({ x: root.x + Math.cos(forkAngle) * reach + (random() - .5) * 4,
                        y: root.y + Math.sin(forkAngle) * reach + (random() - .5) * 4 });
                }
                this.cracks.push({ points: branch, width: .4 + random() * .4 });
            }
        }
        for (let i = 0; i < 180; i++) {
            const direction = random() * Math.PI * 2;
            const distance = Math.sqrt(random()) * radius * .91;
            this.grains.push({ x: Math.cos(direction) * distance, y: Math.sin(direction) * distance,
                size: .5 + random() * 1.7, lift: 8 + random() * 32,
                life: 350 + random() * 650, tone: random() });
        }
    }

    get isExpired(): boolean { return this.ageMs >= this.durationMs; }
    update(deltaMs: number): void {
        if (Number.isFinite(deltaMs)) this.ageMs = Math.min(this.durationMs, this.ageMs + Math.max(0, deltaMs));
    }

    private drawImprint(ctx: CanvasRenderingContext2D): void {
        // Soft disturbed soil and fine texture avoid a clean, illustrated crater outline.
        const soil = ctx.createRadialGradient(15, 0, 5, 0, 0, this.radius * .82);
        soil.addColorStop(0, '#211e1990'); soil.addColorStop(.35, '#302a224d');
        soil.addColorStop(.72, '#39302616'); soil.addColorStop(1, '#39302600');
        ctx.fillStyle = soil;
        ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const crack of this.cracks) {
            ctx.beginPath();
            ctx.moveTo(crack.points[0].x, crack.points[0].y);
            for (const point of crack.points.slice(1)) ctx.lineTo(point.x, point.y);
            ctx.strokeStyle = '#201d18a0'; ctx.lineWidth = crack.width + 2;
            ctx.globalAlpha = .22; ctx.stroke();
            ctx.globalAlpha = .7; ctx.lineWidth = crack.width; ctx.stroke();
        }
        for (const grain of this.grains) {
            ctx.globalAlpha = .12 + grain.tone * .25;
            ctx.fillStyle = grain.tone < .5 ? '#171713' : '#a39476';
            ctx.fillRect(grain.x, grain.y, grain.size, grain.size * .6);
        }
        ctx.save(); ctx.rotate(this.angle);
        for (const side of [-1, 1]) {
            const bruise = ctx.createRadialGradient(27, side * 18, 2, 27, side * 18, 23);
            bruise.addColorStop(0, '#151410b0'); bruise.addColorStop(.45, '#25221a70');
            bruise.addColorStop(1, '#25221a00');
            ctx.globalAlpha = .8; ctx.fillStyle = bruise;
            ctx.fillRect(3, side * 18 - 24, 48, 48);
        }
        ctx.restore(); ctx.globalAlpha = 1;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (this.isExpired) return;
        ctx.save(); ctx.translate(this.x, this.y);
        const fade = Math.min(1, (this.durationMs - this.ageMs) / 3000);
        // Cache only the static scar; allocation is lazy so headless gameplay tests stay safe.
        if (!this.imprint && typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 512;
            const paint = canvas.getContext('2d');
            if (paint) {
                paint.translate(256, 256); paint.scale(256 / (this.radius + 12), 256 / (this.radius + 12));
                this.drawImprint(paint); this.imprint = canvas;
            }
        }
        ctx.globalAlpha = fade * Math.min(1, this.ageMs / 90);
        if (this.imprint) ctx.drawImage(this.imprint, -this.radius - 12, -this.radius - 12,
            (this.radius + 12) * 2, (this.radius + 12) * 2);
        else this.drawImprint(ctx);

        // Broad, broken clouds travel in two pressure fronts; no hard circumference.
        for (let layer = 0; layer < 2; layer++) {
            const t = (this.ageMs - layer * 105) / (850 + layer * 100);
            if (t < 0 || t >= 1) continue;
            const spread = this.radius * (1 - (1 - t) ** 3) * (1 - layer * .15);
            for (let i = 0; i < 30; i++) {
                const direction = i * Math.PI * 2 / 30 + layer * .14;
                const ripple = 1 + Math.sin(i * 2.7 + t * 3) * .065;
                const px = Math.cos(direction) * spread * ripple;
                const py = Math.sin(direction) * spread * ripple;
                const size = (20 + (i * 7 % 19)) * (.55 + t);
                const haze = ctx.createRadialGradient(px, py, 0, px, py, size);
                haze.addColorStop(0, '#d3bb8d70'); haze.addColorStop(.4, '#a9947350');
                haze.addColorStop(1, '#9d876400');
                ctx.globalAlpha = (1 - t) ** 1.6 * (.55 + .25 * Math.sin(i * 4.7)) * (layer ? .5 : .8);
                ctx.fillStyle = haze;
                ctx.fillRect(px - size, py - size, size * 2, size * 2);
            }
        }
        if (this.ageMs < 1100) {
            for (const grain of this.grains) {
                const t = this.ageMs / grain.life;
                if (t >= 1) continue;
                const travel = 1 - (1 - t) ** 2;
                const px = grain.x * travel, py = grain.y * travel - Math.sin(t * Math.PI) * grain.lift;
                ctx.globalAlpha = Math.min(1, t * 12) * (1 - t) * .75;
                ctx.fillStyle = grain.tone < .5 ? '#453c2b' : '#d6c39a';
                ctx.fillRect(px, py, grain.size, grain.size * .65);
            }
            const flash = Math.max(0, 1 - this.ageMs / 220);
            if (flash > 0) {
                const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 65);
                glow.addColorStop(0, '#fff1ce80'); glow.addColorStop(.3, '#d6b77735');
                glow.addColorStop(1, '#d6b77700');
                ctx.globalAlpha = flash; ctx.fillStyle = glow; ctx.fillRect(-65, -65, 130, 130);
            }
        }
        ctx.restore();
    }
}
