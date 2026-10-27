/** Stamp once onto the persistent ground layer. Local noise never consumes combat randomness. */
export function drawScorchMark(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    if (!Number.isFinite(radius) || radius <= 0) return;
    let seed = (Math.imul(Math.round(x * 16), 73856093) ^ Math.imul(Math.round(y * 16), 19349663)) >>> 0;
    const random = (): number => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(random() * Math.PI * 2);
    // A soft charcoal centre, with scattered lobes instead of a sharply outlined crater.
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * .65);
    core.addColorStop(0, 'rgba(0,0,0,.86)');
    core.addColorStop(.45, 'rgba(0,0,0,.7)');
    core.addColorStop(.7, 'rgba(0,0,0,.29)');
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.ellipse(0, 0, radius * .65, radius * .57, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 12; i++) {
        const angle = i / 12 * Math.PI * 2 + random() * .3;
        const distance = radius * (.25 + random() * .3);
        const size = radius * (.12 + random() * .14);
        const px = Math.cos(angle) * distance, py = Math.sin(angle) * distance;
        const soot = ctx.createRadialGradient(px, py, 0, px, py, size);
        soot.addColorStop(0, 'rgba(0,0,0,.32)');
        soot.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = soot;
        ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 65; i++) {
        const angle = random() * Math.PI * 2;
        const distance = radius * (.3 + random() * .7);
        const size = radius * (.007 + random() * .025) * (1.2 - distance / radius * .65);
        ctx.fillStyle = `rgba(0,0,0,${.12 + random() * .32})`;
        ctx.beginPath();
        ctx.ellipse(Math.cos(angle) * distance, Math.sin(angle) * distance,
            size * (1 + random()), size, angle, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
        const angle = random() * Math.PI * 2;
        const start = radius * (.4 + random() * .2);
        const end = start + radius * (.08 + random() * .17);
        ctx.strokeStyle = `rgba(0,0,0,${.12 + random() * .16})`;
        ctx.lineWidth = radius * (.012 + random() * .018);
        ctx.beginPath(); ctx.moveTo(Math.cos(angle) * start, Math.sin(angle) * start);
        ctx.lineTo(Math.cos(angle) * end, Math.sin(angle) * end); ctx.stroke();
    }
    ctx.restore();
}
