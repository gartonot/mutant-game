/** A brief psychic pressure wave. All motion follows the world's simulation clock. */
export class FearWaveEffect {
    private ageMs = 0;
    private readonly durationMs = 850;

    constructor(public readonly x: number, public readonly y: number, public readonly radius = 315) {}

    get isExpired() { return this.ageMs >= this.durationMs; }
    update(deltaMs: number) { this.ageMs = Math.min(this.durationMs, this.ageMs + Math.max(0, deltaMs)); }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.isExpired) return;
        const progress = this.ageMs / this.durationMs;
        const spread = 1 - (1 - progress) ** 3;
        const front = Math.max(1, this.radius * spread);
        const fade = (1 - progress) ** 1.3;
        ctx.save();
        ctx.translate(this.x, this.y);

        // Only tint the narrow moving front, keeping enemies and ground readable.
        const haze = ctx.createRadialGradient(0, 0, front * .68, 0, 0, front);
        haze.addColorStop(0, '#71206900');
        haze.addColorStop(.6, '#8e246d20');
        haze.addColorStop(.85, '#dc3e654a');
        haze.addColorStop(1, '#dc3e6500');
        ctx.globalAlpha = fade;
        ctx.fillStyle = haze;
        ctx.beginPath(); ctx.arc(0, 0, front, 0, Math.PI * 2); ctx.fill();

        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        // Broken curved crests taper at both ends, with a slower violet echo inside.
        for (let layer = 0; layer < 2; layer++) {
            const ring = front * (layer === 0 ? .97 : .78);
            const rotation = progress * (layer === 0 ? .16 : -.22) + layer * .4;
            ctx.strokeStyle = layer === 0 ? '#f888a0' : '#ac7ae6';
            for (let arc = 0; arc < 7; arc++) {
                const start = arc * Math.PI * 2 / 7 + rotation;
                for (let segment = 0; segment < 8; segment++) {
                    const taper = Math.sin((segment + .5) / 8 * Math.PI);
                    ctx.globalAlpha = fade * taper * (layer === 0 ? .8 : .37);
                    ctx.lineWidth = (.5 + taper * 2.2) * (1 - progress * .6);
                    ctx.beginPath();
                    ctx.arc(0, 0, ring, start + segment * .075, start + (segment + 1) * .075 + .005);
                    ctx.stroke();
                }
            }
        }

        // Sparse embers stretch along their outward travel instead of flickering.
        for (let index = 0; index < 18; index++) {
            const angle = index * 2.399963 + .3;
            const distance = front * (.65 + (index % 5) * .065);
            const length = (5 + (index % 4) * 3) * (1 - progress);
            ctx.globalAlpha = fade * (.35 + (index % 3) * .15);
            ctx.strokeStyle = index % 2 ? '#cd9df1' : '#fba7b1';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * (distance - length), Math.sin(angle) * (distance - length));
            ctx.lineTo(Math.cos(angle) * distance, Math.sin(angle) * distance);
            ctx.stroke();
        }

        const flash = Math.max(0, 1 - progress * 4);
        if (flash > 0) {
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 42);
            glow.addColorStop(0, '#f4b5d975');
            glow.addColorStop(.4, '#bd4e9a40');
            glow.addColorStop(1, '#8c326900');
            ctx.globalAlpha = flash;
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}
