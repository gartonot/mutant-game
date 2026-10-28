function noise(seed: number): number {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
}

/** Small surface discharges, driven only by simulation time so pause freezes them. */
export function drawPlasmaOrb(ctx: CanvasRenderingContext2D, x: number, y: number,
    elapsedMs: number, violet: boolean): void {
    const time = Math.max(0, elapsedMs);
    const radius = 27 + Math.sin(time / 180) * 4;
    const aura = violet ? '#b364ff55' : '#64cfff55';
    const rim = violet ? '#e6b0ff' : '#9cfcff';
    const core = violet ? '#fff0ff' : '#edffff';
    const glow = violet ? '#a23cff' : '#348bff';
    const boltColor = violet ? '#d58aff' : '#57caff';
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rim; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();

    const inheritedAlpha = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
        const localTime = time + i * 117;
        const cycle = Math.floor(localTime / 350);
        const life = localTime % 350 / 350;
        const seed = cycle * 31 + i * 173;
        const angle = i * 2.39996 + cycle * .79 + noise(seed + 1) * .7;
        const dx = Math.cos(angle), dy = Math.sin(angle);
        const length = 8 + noise(seed + 2) * 10;
        const phase = Math.floor(localTime / 70);
        const bolt = new Path2D(), fork = new Path2D();
        bolt.moveTo(dx * radius, dy * radius);
        for (let j = 1; j <= 4; j++) {
            const distance = radius + length * j / 4;
            const jitter = j === 4 ? 0 : (noise(seed + phase * 7 + j * 13) * 2 - 1) * 3.5;
            const px = dx * distance - dy * jitter, py = dy * distance + dx * jitter;
            bolt.lineTo(px, py);
            if (j === 2) {
                const side = noise(seed + 4) > .5 ? 1 : -1;
                fork.moveTo(px, py);
                fork.lineTo(px + dx * 2 - dy * side * 3, py + dy * 2 + dx * side * 3);
                fork.lineTo(px + dx * 5 - dy * side * 4, py + dy * 5 + dx * side * 4);
            }
        }
        ctx.globalAlpha = inheritedAlpha * (.15 + .65 * Math.pow(1 - life, .7));
        ctx.shadowColor = glow; ctx.shadowBlur = 7;
        ctx.strokeStyle = boltColor; ctx.lineWidth = 3; ctx.stroke(bolt);
        ctx.lineWidth = 1.4; ctx.stroke(fork);
        ctx.shadowBlur = 2; ctx.strokeStyle = core;
        ctx.lineWidth = 1; ctx.stroke(bolt);
        ctx.lineWidth = .5; ctx.stroke(fork);
    }
    ctx.restore();
}
