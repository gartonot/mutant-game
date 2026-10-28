/** A small charred patch with cooled plasma residue, aged by simulation time. */
export class PlasmaOrbScorch {
    private static readonly textures = new Map<boolean, HTMLCanvasElement>();
    private ageMs = 0;

    constructor(public readonly x: number, public readonly y: number, private readonly violet: boolean) {}

    get isExpired(): boolean { return this.ageMs >= 12000; }

    update(deltaMs: number): void {
        if (Number.isFinite(deltaMs)) this.ageMs = Math.min(12000, this.ageMs + Math.max(0, deltaMs));
    }

    private static getTexture(violet: boolean): HTMLCanvasElement | null {
        const cached = this.textures.get(violet);
        if (cached) return cached;
        if (typeof document === 'undefined') return null;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 160;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.translate(80, 80);
        let seed = 0x70ab31;
        const random = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        const smudge = (x: number, y: number, radius: number, color: string): void => {
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, color);
            gradient.addColorStop(.3, color);
            gradient.addColorStop(1, 'rgba(15,17,22,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        };
        smudge(-3, 2, 52, 'rgba(14,16,21,.42)');
        for (let i = 0; i < 27; i++) {
            const angle = i * 2.399963;
            const distance = Math.sqrt(random()) * 41;
            smudge(Math.cos(angle) * distance, Math.sin(angle) * distance,
                8 + random() * 19, `rgba(11,13,18,${.16 + random() * .2})`);
        }
        const tint = violet ? '147,99,188' : '74,154,177';
        for (let i = 0; i < 16; i++) {
            const angle = random() * Math.PI * 2;
            const distance = Math.sqrt(random()) * 37;
            smudge(Math.cos(angle) * distance, Math.sin(angle) * distance,
                4 + random() * 9, `rgba(${tint},${.12 + random() * .12})`);
        }
        for (let i = 0; i < 170; i++) {
            const angle = random() * Math.PI * 2;
            const distance = Math.sqrt(random()) * 55;
            const alpha = (1 - Math.pow(distance / 58, 3)) * (.16 + random() * .23);
            ctx.fillStyle = i % 6 === 0 ? `rgba(${tint},${alpha * .8})` : `rgba(8,10,14,${alpha})`;
            ctx.beginPath();
            ctx.ellipse(Math.cos(angle) * distance, Math.sin(angle) * distance,
                .4 + random() * 1.6, .3 + random() * .65, angle, 0, Math.PI * 2);
            ctx.fill();
        }
        this.textures.set(violet, canvas);
        return canvas;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (this.isExpired || this.ageMs <= 0) return;
        const texture = PlasmaOrbScorch.getTexture(this.violet);
        if (!texture) return;
        const appear = Math.min(1, this.ageMs / 120);
        const fade = Math.min(1, (12000 - this.ageMs) / 4000);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(((Math.round(this.x * 7) ^ Math.round(this.y * 11)) >>> 0) % 628 / 100);
        ctx.globalAlpha *= appear * appear * (3 - 2 * appear) * fade * fade * (3 - 2 * fade);
        ctx.drawImage(texture, -60, -60, 120, 120);
        ctx.restore();
    }
}
