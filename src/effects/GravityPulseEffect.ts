/** Three elastic pressure fronts, animated entirely by the simulation clock. */
export class GravityPulseEffect {
    private ageMs = 0;
    private readonly durationMs = 1100;

    constructor(public readonly x: number, public readonly y: number, public readonly radius = 240) {}

    get isExpired() { return this.ageMs >= this.durationMs; }
    update(deltaMs: number) { this.ageMs = Math.min(this.durationMs, this.ageMs + Math.max(0, deltaMs)); }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.isExpired) return;
        const time = this.ageMs / 1000;
        const radius = Math.max(1, this.radius);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        for (let wave = 0; wave < 3; wave++) {
            const localAge = this.ageMs - wave * 110;
            if (localAge < 0 || localAge >= 880) continue;
            const progress = localAge / 880;
            const spread = 1 - (1 - progress) ** 2.6;
            const front = 7 + (radius - 7) * spread;
            const fade = Math.min(1, localAge / 28) * (1 - progress) ** 1.1;
            // The large lobes bend slowly; smaller travelling ripples make the
            // surface vibrate continuously without random jitter between frames.
            const amplitude = Math.min(front * .16, 10) * (.45 + .55 * (1 - progress));
            ctx.beginPath();
            for (let step = 0; step <= 128; step++) {
                const angle = step / 128 * Math.PI * 2;
                const ripple = Math.sin(angle * 5 + time * 8 + wave * 1.7) * .54
                    + Math.sin(angle * 11 - time * 17 + wave * .8) * .30
                    + Math.sin(angle * 19 + time * 24 - wave) * .16;
                const distance = front + amplitude * ripple;
                const px = Math.cos(angle) * distance;
                const py = Math.sin(angle) * distance;
                if (step === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();

            // Reuse the contour for its soft halo and sharp crest. No shadow
            // filter or full-disc fill: silhouettes remain visible inside it.
            ctx.strokeStyle = wave === 1 ? '#9d70ff' : '#51c9ed';
            ctx.globalAlpha = fade * .10;
            ctx.lineWidth = 17 - progress * 8;
            ctx.stroke();
            ctx.globalAlpha = fade * .23;
            ctx.lineWidth = 6 - progress * 3;
            ctx.stroke();
            ctx.strokeStyle = wave === 1 ? '#d6b6ff' : '#b9f6ff';
            ctx.globalAlpha = fade * (wave === 0 ? .86 : .66);
            ctx.lineWidth = 1.8 - progress * .8;
            ctx.stroke();
        }

        const progress = this.ageMs / this.durationMs;
        const spread = 1 - (1 - progress) ** 2.8;
        // Sparse outward streaks leave air between the fronts rather than
        // turning the effect into a solid glowing disc.
        for (let index = 0; index < 20; index++) {
            const angle = index * 2.399963 + .37;
            const travel = radius * spread * (.56 + (index % 5) * .075);
            const length = (5 + index % 4 * 3) * Math.sin(Math.PI * progress) * (1 - progress);
            ctx.globalAlpha = (1 - progress) ** 2 * .58;
            ctx.strokeStyle = index % 3 === 0 ? '#c9a3ff' : '#92dbe9';
            ctx.lineWidth = index % 3 === 0 ? 1.5 : .8;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * (travel - length), Math.sin(angle) * (travel - length));
            ctx.lineTo(Math.cos(angle) * travel, Math.sin(angle) * travel);
            ctx.stroke();
        }

        // A short contracting lens marks the origin of the pressure impulse.
        const flash = Math.max(0, 1 - this.ageMs / 240);
        if (flash > 0) {
            const lensRadius = 9 + 32 * flash;
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, lensRadius);
            glow.addColorStop(0, '#e9faffbb');
            glow.addColorStop(.22, '#a9cfff66');
            glow.addColorStop(.65, '#9564e528');
            glow.addColorStop(1, '#9564e500');
            ctx.globalAlpha = flash;
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(0, 0, lensRadius, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}
