function smooth(value: number): number {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
}

/** Local +X faces forward. Each recorded strike plays once, then returns to rest. */
export function drawMutantClaws(ctx: CanvasRenderingContext2D, elapsedMs: number, strikeTimes: readonly number[]): void {
    const time = Math.max(0, elapsedMs);
    for (let hand = 0; hand < 2; hand++) {
        const side = hand === 0 ? -1 : 1;
        const sinceStrike = time - strikeTimes[hand];
        const striking = Number.isFinite(sinceStrike) && sinceStrike >= 0 && sinceStrike < 300;
        const sweep = !striking ? 0 : sinceStrike < 40
            ? -.65 * smooth(sinceStrike / 40)
            : sinceStrike < 120
                ? -.65 + 1.3 * smooth((sinceStrike - 40) / 80)
                : .65 * (1 - smooth((sinceStrike - 120) / 180));
        const reach = !striking ? 0 : sinceStrike < 120
            ? 6 * smooth(sinceStrike / 120)
            : 6 * (1 - smooth((sinceStrike - 120) / 180));

        ctx.save();
        ctx.translate(10, side * 18);
        ctx.rotate(side * (.45 - sweep));
        ctx.translate(reach, 0);

        drawPaw(ctx, hand);
        ctx.restore();

        if (striking && sinceStrike >= 40 && sinceStrike < 120) {
            ctx.save();
            ctx.translate(10, side * 18);
            ctx.scale(1, side);
            ctx.globalAlpha *= Math.sin(Math.PI * (sinceStrike - 40) / 80) * .17;
            // Short crescent ribbons follow the talon sweep, never a full ring.
            for (let blade = 0; blade < 3; blade++) {
                const radius = 36 + blade * 5;
                const start = -.65 - sweep;
                const end = start + .85;
                ctx.fillStyle = blade === 1 ? '#c1b58b' : '#91845d';
                ctx.beginPath();
                ctx.arc(0, 0, radius, start, end);
                ctx.quadraticCurveTo(Math.cos(end - .25) * (radius - 4), Math.sin(end - .25) * (radius - 4), Math.cos(start) * radius, Math.sin(start) * radius);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
    }
}

const paws: HTMLCanvasElement[] = [];
function grain(seed: number): number {
    const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
}
function drawPaw(ctx: CanvasRenderingContext2D, hand: number): void {
    if (!paws[hand]) {
        const canvas = document.createElement('canvas');
        canvas.width = 160; canvas.height = 96;
        const paint = canvas.getContext('2d')!;
        paint.scale(2, 2); paint.translate(16, 24);
        paintPaw(paint, hand);
        paws[hand] = canvas;
    }
    ctx.drawImage(paws[hand], -16, -24, 80, 48);
}
function paintPaw(ctx: CanvasRenderingContext2D, hand: number): void {
        // A fleshy wrist and knuckled shell anchor the talons to the mutant's body.
        const skin = ctx.createLinearGradient(-5, -10, 18, 11);
        skin.addColorStop(0, '#3c3425');
        skin.addColorStop(.42, '#918956');
        skin.addColorStop(.68, '#665c36');
        skin.addColorStop(1, '#30271e');
        ctx.fillStyle = '#10180e66';
        ctx.beginPath();
        ctx.ellipse(11, 3, 19, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.moveTo(-9, -7);
        ctx.bezierCurveTo(0, -10, 8, -14, 16, -10);
        ctx.bezierCurveTo(23, -12, 27, -4, 23, 0);
        ctx.bezierCurveTo(28, 7, 18, 13, 12, 10);
        ctx.bezierCurveTo(4, 13, -3, 7, -9, 7);
        ctx.closePath();
        ctx.fill();
        ctx.save(); ctx.clip();
        for (let i = 0; i < 230; i++) {
            const seed = i + hand * 311;
            const px = -9 + grain(seed) * 38, py = -14 + grain(seed + 71) * 28;
            ctx.fillStyle = i % 3 === 0 ? '#b9a87855' : i % 3 === 1 ? '#332b2180' : '#70533365';
            ctx.beginPath(); ctx.ellipse(px, py, .3 + grain(seed + 9) * 1.3,
                .25 + grain(seed + 28) * .7, grain(seed + 31) * 3, 0, Math.PI * 2); ctx.fill();
        }
        for (let i = 0; i < 9; i++) {
            const px = -5 + i * 3.2, py = -6 + grain(i + hand * 41) * 12;
            ctx.strokeStyle = i % 3 ? '#352b2270' : '#5a282586'; ctx.lineWidth = .55;
            ctx.beginPath(); ctx.moveTo(px, py - 3);
            ctx.quadraticCurveTo(px - 2, py, px + 1.5, py + 4); ctx.stroke();
        }
        ctx.restore();

        for (let claw = 0; claw < 3; claw++) {
            const y = (claw - 1) * 7 + grain(claw + hand * 13) * 1.4;
            const length = (claw === 1 ? 20 : 16) + grain(claw + hand * 19) * 2;
            const root = 17 + (claw === 1 ? 3 : 0);
            ctx.fillStyle = '#29301f';
            ctx.beginPath();
            ctx.ellipse(root, y, 6, 4.5, -.15, 0, Math.PI * 2);
            ctx.fill();
            const horn = ctx.createLinearGradient(root, y - 3, root + length, y + 5);
            horn.addColorStop(0, '#50402d');
            horn.addColorStop(.27, '#867850');
            horn.addColorStop(.58, '#b3a77d');
            horn.addColorStop(1, '#8e8762');
            ctx.fillStyle = horn;
            ctx.beginPath();
            ctx.moveTo(root - 2, y - 3.5);
            ctx.bezierCurveTo(root + 9, y - 6, root + length - 1, y - 3, root + length, y + 8);
            ctx.bezierCurveTo(root + length - 6, y + 1, root + 7, y + 3.5, root - 2, y + 3);
            ctx.closePath();
            ctx.fill();
            ctx.save(); ctx.clip();
            for (let ridge = 0; ridge < 7; ridge++) {
                ctx.strokeStyle = ridge % 2 ? '#483c2e55' : '#d3c29440'; ctx.lineWidth = .35;
                ctx.beginPath(); ctx.moveTo(root - 2, y - 3 + ridge);
                ctx.bezierCurveTo(root + 8, y - 5 + ridge * .7, root + length - 3,
                    y - 3 + ridge * .6, root + length, y + 8); ctx.stroke();
            }
            for (let i = 0; i < 55; i++) {
                const seed = i + claw * 97 + hand * 13;
                ctx.fillStyle = i % 2 ? '#30241d55' : '#c8b7803a';
                ctx.fillRect(root + grain(seed) * length, y - 6 + grain(seed + 5) * 14, .4, .7);
            }
            ctx.restore();
            // Narrow upper facet adds volume while the outer silhouette stays sharply tapered.
            ctx.fillStyle = '#d2c39428';
            ctx.beginPath();
            ctx.moveTo(root + 1, y - 2.8);
            ctx.bezierCurveTo(root + 9, y - 4.3, root + length - 5, y - 2, root + length - 2, y + 4);
            ctx.bezierCurveTo(root + length - 7, y - .7, root + 8, y - 1, root + 1, y - 1.2);
            ctx.fill();
        }
}
