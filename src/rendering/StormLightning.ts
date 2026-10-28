/** Cosmetic noise stays independent from the gameplay random sequence. */
function noise(seed: number): number {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
}

/** Loose, branching discharges using the electric weapon's cyan/white stroke treatment.
 * The caller supplies simulation time so the entire field freezes when paused.
 */
export function drawStormLightning(ctx: CanvasRenderingContext2D, x: number, y: number,
    elapsedMs: number, radius = 110): void {
    if (radius <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const inheritedAlpha = ctx.globalAlpha;
    for (let i = 0; i < 5; i++) {
        const time = Math.max(0, elapsedMs) + i * 83;
        const cycle = Math.floor(time / 390);
        const life = time % 390 / 390;
        const seed = cycle * 31 + i * 173;
        const heading = i * 2.39996 + cycle * .73 + noise(seed + 1) * .9;
        const spread = (.38 + noise(seed + 2) * .55) * (noise(seed + 3) > .5 ? 1 : -1);
        const startRadius = radius * (.3 + noise(seed + 4) * .42);
        const endRadius = radius * (.58 + noise(seed + 5) * .34);
        const ax = Math.cos(heading) * startRadius, ay = Math.sin(heading) * startRadius;
        const bx = Math.cos(heading + spread) * endRadius, by = Math.sin(heading + spread) * endRadius;
        const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
        const nx = -dy / length, ny = dx / length;
        const steps = Math.max(4, Math.ceil(length / 11));
        const phase = Math.floor(time / 65);
        const bolt = new Path2D(), branches = new Path2D();
        bolt.moveTo(ax, ay);
        for (let j = 1; j <= steps; j++) {
            const t = j / steps;
            const jitter = j === steps ? 0 : (noise(seed + phase * 7 + j * 13) * 2 - 1) * Math.min(12, radius * .11);
            const px = ax + dx * t + nx * jitter, py = ay + dy * t + ny * jitter;
            bolt.lineTo(px, py);
            if (j === 2 || (j === steps - 2 && steps > 6)) {
                const side = noise(seed + j * 3) > .5 ? 1 : -1;
                const fork = radius * (.1 + noise(seed + j) * .13);
                branches.moveTo(px, py);
                branches.lineTo(px + nx * side * fork * .5 + dx / length * 5,
                    py + ny * side * fork * .5 + dy / length * 5);
                branches.lineTo(px + nx * side * fork * .65 - dx / length * 3,
                    py + ny * side * fork * .65 - dy / length * 3);
                branches.lineTo(px + nx * side * fork + dx / length * 8,
                    py + ny * side * fork + dy / length * 8);
            }
        }
        // Each discharge flashes and decays on its own rhythm, without a rotating outline.
        ctx.globalAlpha = inheritedAlpha * (.12 + .78 * Math.pow(1 - life, .65));
        ctx.shadowColor = '#348bff'; ctx.shadowBlur = 17;
        ctx.strokeStyle = '#2869ff55'; ctx.lineWidth = 10; ctx.stroke(bolt);
        ctx.shadowBlur = 10; ctx.strokeStyle = '#57caffbb'; ctx.lineWidth = 4.5; ctx.stroke(bolt);
        ctx.lineWidth = 1.8; ctx.stroke(branches);
        ctx.shadowBlur = 4; ctx.strokeStyle = '#f0fdff'; ctx.lineWidth = 1.6; ctx.stroke(bolt);
        ctx.strokeStyle = '#c5efff'; ctx.lineWidth = .7; ctx.stroke(branches);
    }
    ctx.restore();
}
