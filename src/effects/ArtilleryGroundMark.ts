/** Soft, persistent disturbed soil left by an artillery impact. */
export class ArtilleryGroundMark {
    private ageMs = 0;
    private imprint: HTMLCanvasElement | null = null;
    private readonly durationMs = 12000;

    constructor(public readonly x: number, public readonly y: number,
        private readonly radius = 45) {}

    get isExpired(): boolean { return this.ageMs >= this.durationMs; }

    update(deltaMs: number): void {
        if (Number.isFinite(deltaMs)) this.ageMs = Math.min(this.durationMs, this.ageMs + Math.max(0, deltaMs));
    }

    private paint(ctx: CanvasRenderingContext2D): void {
        let seed = (Math.round(this.x * 73) ^ Math.round(this.y * 193) ^ 0x715ca2) >>> 0;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        const r = this.radius;
        const blot = (x: number, y: number, size: number, color: string) => {
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
            gradient.addColorStop(0, color); gradient.addColorStop(1, '#18151000');
            ctx.fillStyle = gradient;
            ctx.fillRect(x - size, y - size, size * 2, size * 2);
        };
        // Overlapping soot patches give the edge an uneven, feathered silhouette.
        blot(0, 0, r * 1.08, '#19171388');
        for (let i = 0; i < 15; i++) {
            const a = random() * Math.PI * 2;
            const d = r * (.16 + random() * .48);
            blot(Math.cos(a) * d, Math.sin(a) * d * .78, r * (.3 + random() * .25), '#1515103b');
        }
        // A shaded depression and disconnected soil clumps suggest a shallow crater.
        ctx.save(); ctx.scale(1, .76);
        blot(0, -r * .09, r * .61, '#131410bd');
        for (let i = 0; i < 32; i++) {
            const a = i * 2.399963 + random() * .3;
            const d = r * (.42 + random() * .25);
            const x = Math.cos(a) * d, y = Math.sin(a) * d;
            const size = r * (.05 + random() * .1);
            blot(x, y, size * 1.7, '#11130f48');
            ctx.fillStyle = y > 0 ? '#8d7c5542' : '#473f2e40';
            ctx.beginPath();
            ctx.ellipse(x, y + size * .25, size, size * .38, a, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        for (let i = 0; i < 125; i++) {
            const a = random() * Math.PI * 2;
            const d = Math.sqrt(random()) * r * 1.13;
            const x = Math.cos(a) * d, y = Math.sin(a) * d * .83;
            const size = .5 + random() * 1.65;
            ctx.fillStyle = random() < .65 ? '#14161155' : '#a1937030';
            ctx.fillRect(x, y, size, size * .65);
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (this.isExpired) return;
        const extent = Math.ceil(this.radius * 1.7);
        if (!this.imprint && typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = extent * 2;
            const cached = canvas.getContext('2d');
            if (cached) {
                cached.translate(extent, extent);
                this.paint(cached);
                this.imprint = canvas;
            }
        }
        const appear = Math.min(1, this.ageMs / 100);
        const fade = Math.min(1, (this.durationMs - this.ageMs) / 4000);
        ctx.save();
        ctx.globalAlpha *= appear * (fade * fade * (3 - 2 * fade));
        if (this.imprint) ctx.drawImage(this.imprint, this.x - extent, this.y - extent);
        else {
            ctx.translate(this.x, this.y);
            this.paint(ctx);
        }
        ctx.restore();
    }
}
