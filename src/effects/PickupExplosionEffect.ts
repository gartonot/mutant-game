interface ExplosionPuff {
    x: number;
    y: number;
    radius: number;
    angle: number;
    lobes: number[];
}

/** Simultaneous local fireballs. Damage and ground marks belong to the caller. */
export class PickupExplosionEffect {
    private ageMs = 0;
    private readonly durationMs = 600;
    private readonly puffs: ExplosionPuff[];

    constructor(public readonly x: number, public readonly y: number, public readonly radius: number) {
        let seed = (Math.round(x * 19) ^ Math.round(y * 73) ^ Math.round(radius * 11)) >>> 0;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        const rotation = random() * Math.PI * 2;
        this.puffs = Array.from({ length: 8 }, (_, index) => {
            const angle = rotation + (index - 1) * Math.PI * 2 / 7 + (random() - .5) * .2;
            const distance = index === 0 ? 0 : radius * (.48 + random() * .17);
            return {
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                radius: radius * (index === 0 ? .29 : .17 + random() * .055),
                angle: random() * Math.PI * 2,
                lobes: Array.from({ length: 10 }, () => .72 + random() * .28),
            };
        });
    }

    get isExpired() { return this.ageMs >= this.durationMs; }
    update(deltaMs: number) { this.ageMs = Math.min(this.durationMs, this.ageMs + Math.max(0, deltaMs)); }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.isExpired) return;
        const progress = this.ageMs / this.durationMs;
        const expansion = .3 + .7 * (1 - (1 - Math.min(1, progress * 3)) ** 3);
        const heat = Math.max(0, 1 - progress / .67);
        ctx.save();
        ctx.translate(this.x, this.y);
        for (const puff of this.puffs) {
            const size = puff.radius * expansion;
            const drift = progress * puff.radius * .2;
            ctx.save();
            ctx.translate(puff.x, puff.y - drift);
            // Separate soft smoke lobes preserve the gaps between the explosions.
            ctx.globalAlpha = Math.sin(progress * Math.PI) * .38;
            for (let index = 0; index < puff.lobes.length; index++) {
                const angle = puff.angle + index * Math.PI * 2 / puff.lobes.length;
                const lobe = puff.lobes[index];
                const sx = Math.cos(angle) * size * .45;
                const sy = Math.sin(angle) * size * .45;
                const smokeSize = size * lobe * (.5 + progress * .3);
                const smoke = ctx.createRadialGradient(sx, sy, 0, sx, sy, smokeSize);
                smoke.addColorStop(0, '#292521');
                smoke.addColorStop(.55, '#34302bd0');
                smoke.addColorStop(1, '#34302b00');
                ctx.fillStyle = smoke;
                ctx.beginPath(); ctx.arc(sx, sy, smokeSize, 0, Math.PI * 2); ctx.fill();
            }
            if (heat > 0) {
                ctx.globalAlpha = heat * .85;
                const fire = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
                fire.addColorStop(0, '#fff9cc');
                fire.addColorStop(.23, '#ffe785');
                fire.addColorStop(.48, '#ffb22d');
                fire.addColorStop(.72, '#e55713cb');
                fire.addColorStop(1, '#b32b0600');
                ctx.fillStyle = fire;
                ctx.beginPath();
                for (let index = 0; index < 40; index++) {
                    const angle = puff.angle + index * Math.PI * 2 / 40;
                    const lobe = puff.lobes[Math.floor(index / 4)];
                    const edge = size * (lobe + .08 * Math.sin(index * 1.7));
                    const px = Math.cos(angle) * edge;
                    const py = Math.sin(angle) * edge;
                    if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath(); ctx.fill();
            }
            ctx.globalAlpha = (1 - progress) ** 2;
            ctx.fillStyle = progress < .4 ? '#ffe896' : '#ff8b29';
            for (let index = 0; index < 7; index++) {
                const angle = puff.angle + index * 2.399;
                const travel = puff.radius * (.2 + progress * .85) * puff.lobes[index];
                const emberSize = 1 + 2 * (1 - progress);
                ctx.beginPath();
                ctx.ellipse(Math.cos(angle) * travel, Math.sin(angle) * travel,
                    emberSize * 2, emberSize * .65, angle, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.restore();
    }
}
