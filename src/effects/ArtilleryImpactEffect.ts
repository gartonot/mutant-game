interface BlastLobe {
    angle: number;
    reach: number;
    size: number;
    delay: number;
    drift: number;
}

/** Local fire, rolling smoke and kicked-up soil; deliberately no screen flash. */
export class ArtilleryImpactEffect {
    private ageMs = 0;
    private readonly durationMs = 1120;
    private readonly lobes: BlastLobe[] = [];
    private readonly debris: { angle: number; reach: number; size: number; lift: number }[] = [];

    constructor(public readonly x: number, public readonly y: number, public readonly radius = 95) {
        let seed = (Math.round(x * 31) ^ Math.round(y * 89) ^ 0xa471) >>> 0;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let i = 0; i < 10; i++) {
            this.lobes.push({ angle: i * 2.399963 + random() * .35,
                reach: .22 + random() * .32, size: .16 + random() * .11,
                delay: random() * 70, drift: random() * .08 });
        }
        for (let i = 0; i < 27; i++) {
            this.debris.push({ angle: random() * Math.PI * 2,
                reach: .4 + random() * .48, size: .7 + random() * 1.8,
                lift: .08 + random() * .19 });
        }
    }

    get isExpired(): boolean { return this.ageMs >= this.durationMs; }

    update(deltaMs: number): void {
        if (Number.isFinite(deltaMs)) this.ageMs = Math.min(this.durationMs, this.ageMs + Math.max(0, deltaMs));
    }

    private puff(ctx: CanvasRenderingContext2D, x: number, y: number, size: number,
        inner: string, middle: string, outer: string, alpha: number): void {
        if (alpha <= 0 || size <= 0) return;
        const gradient = ctx.createRadialGradient(x - size * .13, y - size * .18, 0, x, y, size);
        gradient.addColorStop(0, inner);
        gradient.addColorStop(.4, middle);
        gradient.addColorStop(1, outer);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = gradient;
        ctx.fillRect(x - size, y - size, size * 2, size * 2);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (this.isExpired) return;
        const age = this.ageMs;
        const radius = Math.max(1, this.radius);
        const progress = age / this.durationMs;
        const spread = 1 - Math.exp(-age / 160);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalCompositeOperation = 'source-over';

        // Low, warm soil haze gives the explosion weight without washing out the arena.
        ctx.save(); ctx.scale(1, .72);
        this.puff(ctx, 0, 0, radius * (.2 + spread * .67),
            '#35291e', '#57432a', '#57432a00', Math.sin(Math.PI * progress) * .3);
        ctx.restore();

        for (const lobe of this.lobes) {
            const localAge = Math.max(0, age - lobe.delay);
            const travel = 1 - Math.exp(-localAge / 180);
            const x = Math.cos(lobe.angle) * radius * lobe.reach * travel;
            const y = Math.sin(lobe.angle) * radius * lobe.reach * travel - radius * lobe.drift * progress;
            const size = radius * lobe.size * (.45 + travel * .6);
            const fire = Math.sin(Math.PI * Math.min(1, localAge / 420));
            this.puff(ctx, x, y, size, '#ffbe54', '#d35b20', '#94341400', fire * .68);
        }

        // A small amber impact core rises and fades once, never a broad white flash.
        const core = Math.sin(Math.PI * Math.min(1, age / 180));
        this.puff(ctx, 0, -2, Math.min(25, radius * .27),
            '#ffe8a1', '#ffa447', '#e6652600', core * .85);

        for (const lobe of this.lobes) {
            const smokeAge = Math.max(0, age - lobe.delay - 100);
            const travel = 1 - Math.exp(-smokeAge / 240);
            const fade = Math.sin(Math.PI * Math.min(1, smokeAge / (1020 - lobe.delay)));
            const x = Math.cos(lobe.angle) * radius * lobe.reach * travel;
            const y = Math.sin(lobe.angle) * radius * lobe.reach * travel - radius * (.12 + lobe.drift) * travel;
            this.puff(ctx, x, y, radius * lobe.size * (.7 + travel * .45),
                '#62574b', '#423c35', '#34302900', fade * .43);
        }

        const flight = Math.min(1, age / 740);
        const distance = 1 - (1 - flight) ** 2;
        for (let i = 0; i < this.debris.length; i++) {
            const grain = this.debris[i];
            const x = Math.cos(grain.angle) * radius * grain.reach * distance;
            const groundY = Math.sin(grain.angle) * radius * grain.reach * distance;
            const y = groundY - Math.sin(flight * Math.PI) * radius * grain.lift;
            ctx.globalAlpha = Math.min(1, age / 35) * (1 - progress) ** .8;
            ctx.fillStyle = i % 4 === 0 && age < 300 ? '#ca8b43' : i % 2 ? '#79654a' : '#342b22';
            ctx.beginPath();
            ctx.ellipse(x, y, grain.size, grain.size * .65, grain.angle + flight * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
