const TAU = Math.PI * 2;

function noise(seed: number): number {
    const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
}

/** Both ends of the transformation ease to rest; simulation time also freezes the mist. */
export function mutantTransformationState(elapsedMs: number, remainingMs: number): {
    blend: number; activity: number;
} {
    const progress = Math.max(0, Math.min(elapsedMs / 700, remainingMs / 850, 1));
    const blend = progress * progress * (3 - 2 * progress);
    return { blend, activity: progress === 0 || progress === 1 ? 0 : Math.sin(Math.PI * blend) };
}

function mist(ctx: CanvasRenderingContext2D, time: number, activity: number, front: boolean): void {
    const alpha = ctx.globalAlpha;
    // Uneven translucent tissue vapour hides the silhouette handoff without a hard aura rim.
    for (let i = front ? 10 : 0; i < (front ? 16 : 10); i++) {
        const angle = i * 2.399963 + time * (.18 + noise(i + 5) * .22);
        const orbit = 16 + noise(i + 2) * 25 + Math.sin(time * 3 + i) * 5;
        const x = Math.cos(angle) * orbit;
        const y = Math.sin(angle) * orbit * .78 - 7;
        const radius = 15 + noise(i + 30) * 15;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, front ? '#a9ba704d' : '#7d994d70');
        gradient.addColorStop(.38, '#687b4140');
        gradient.addColorStop(1, '#45572d00');
        ctx.globalAlpha = alpha * activity * (front ? .65 : .9);
        ctx.fillStyle = gradient;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.globalAlpha = alpha;
}

/** Callbacks draw the existing character sprites at local (0, 0), preserving their facing. */
export function drawMutantTransformation(ctx: CanvasRenderingContext2D, x: number, y: number,
    elapsedMs: number, remainingMs: number,
    drawHuman: (ctx: CanvasRenderingContext2D) => void,
    drawMutant: (ctx: CanvasRenderingContext2D) => void): void {
    const { blend, activity } = mutantTransformationState(elapsedMs, remainingMs);
    const time = Math.max(0, elapsedMs) / 1000;
    ctx.save();
    ctx.translate(x, y);
    const alpha = ctx.globalAlpha;
    if (activity > .001) mist(ctx, time, activity, false);

    if (blend < 1) {
        ctx.save();
        ctx.globalAlpha = alpha * (1 - blend);
        const tension = Math.sin(time * 12) * activity * .025;
        ctx.scale(1 + tension, 1 - tension);
        drawHuman(ctx);
        ctx.restore();
    }
    if (blend > 0) {
        ctx.save();
        ctx.globalAlpha = alpha * blend;
        const size = .78 + .22 * blend;
        const breath = Math.sin(time * 10) * activity * .045;
        ctx.scale(size * (1 + breath), size * (1 - breath * .65));
        drawMutant(ctx);
        ctx.restore();
    }

    if (activity > .001) {
        mist(ctx, time, activity, true);
        // A restrained warm bloom and drifting spores, never a screen flash or circular outline.
        const glow = ctx.createRadialGradient(0, -5, 0, 0, -5, 38);
        glow.addColorStop(0, '#d1c58632');
        glow.addColorStop(.4, '#9b9d6030');
        glow.addColorStop(1, '#737c4200');
        ctx.globalAlpha = alpha * activity;
        ctx.fillStyle = glow;
        ctx.fillRect(-38, -43, 76, 76);
        ctx.lineCap = 'round';
        for (let i = 0; i < 22; i++) {
            const angle = i * 2.399963 + .16 * time;
            const drift = (time * (.32 + noise(i + 50) * .18) + noise(i + 90)) % 1;
            const distance = 19 + drift * 43;
            const px = Math.cos(angle) * distance;
            const py = Math.sin(angle) * distance * .72 - drift * 15;
            ctx.globalAlpha = alpha * activity * Math.sin(drift * Math.PI) * .65;
            ctx.fillStyle = i % 3 ? '#b9bd7f' : '#d1c490';
            ctx.beginPath();
            ctx.ellipse(px, py, .7 + noise(i + 10), .5 + noise(i + 20) * .65, angle, 0, TAU);
            ctx.fill();
        }
    }
    ctx.restore();
}
