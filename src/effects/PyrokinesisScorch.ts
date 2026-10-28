/** A soft, mottled burn that outlives the fire and fades with simulation time. */
export class PyrokinesisScorch {
    private static texture: HTMLCanvasElement | null = null;
    private ageMs = 0;

    constructor(public readonly x: number, public readonly y: number, public readonly radius = 125,
        private readonly durationMs = 17000, private readonly appearMs = 1000) {}

    get isExpired(): boolean { return this.ageMs >= this.durationMs; }

    update(deltaMs: number): void {
        if (Number.isFinite(deltaMs)) this.ageMs = Math.min(this.durationMs, this.ageMs + Math.max(0, deltaMs));
    }

    private static getTexture(): HTMLCanvasElement | null {
        if (this.texture) return this.texture;
        if (typeof document === 'undefined') return null;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 320;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.translate(160, 160);
        let seed = 0x5c04c4;
        const random = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        const smudge = (x: number, y: number, size: number, color: string): void => {
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
            gradient.addColorStop(0, color);
            gradient.addColorStop(.35, color);
            gradient.addColorStop(1, 'rgba(29,21,15,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(x - size, y - size, size * 2, size * 2);
        };
        // Overlapping burns leave an uneven, feathered perimeter without a ring.
        smudge(-7, 4, 111, 'rgba(29,20,13,.42)');
        for (let i = 0; i < 37; i++) {
            const angle = i * 2.399963;
            const distance = Math.sqrt(random()) * 98;
            smudge(Math.cos(angle) * distance, Math.sin(angle) * distance,
                22 + random() * 31, `rgba(19,16,13,${.14 + random() * .15})`);
        }
        // Fine ash flecks and elongated char fragments break up the dark mass.
        for (let i = 0; i < 360; i++) {
            const angle = random() * Math.PI * 2;
            const distance = Math.sqrt(random()) * 122;
            const edge = 1 - Math.pow(distance / 128, 3);
            const x = Math.cos(angle) * distance, y = Math.sin(angle) * distance;
            ctx.fillStyle = i % 5 === 0
                ? `rgba(143,124,96,${edge * (.08 + random() * .11)})`
                : `rgba(12,11,9,${edge * (.13 + random() * .23)})`;
            ctx.beginPath();
            ctx.ellipse(x, y, .4 + random() * 2.4, .3 + random() * .85,
                random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
        this.texture = canvas;
        return canvas;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (this.isExpired || this.ageMs <= 0 || !Number.isFinite(this.radius) || this.radius <= 0) return;
        const texture = PyrokinesisScorch.getTexture();
        if (!texture) return;
        const appear = Math.min(1, this.ageMs / this.appearMs);
        const fade = Math.min(1, (this.durationMs - this.ageMs) / 4000);
        const alpha = appear * appear * (3 - 2 * appear) * fade * fade * (3 - 2 * fade);
        const size = this.radius * 2.48;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(((Math.round(this.x * 7) ^ Math.round(this.y * 11)) >>> 0) % 628 / 100);
        ctx.globalAlpha *= alpha;
        ctx.drawImage(texture, -size / 2, -size / 2, size, size);
        ctx.restore();
    }
}
