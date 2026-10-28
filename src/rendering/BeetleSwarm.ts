const TAU = Math.PI * 2;
const FRAMES = 8;
const SIZE = 32;
const PALETTES = [
    ['#152a20', '#457d4c', '#9cb67a'],
    ['#162b29', '#39736a', '#8dbba0'],
    ['#282c18', '#6a783a', '#b7bd77'],
] as const;

function noise(seed: number): number {
    const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
}

const beetles = Array.from({ length: 72 }, (_, i) => ({
    angle: i * 2.399963,
    distance: .16 + Math.sqrt((i + .5) / 72) * .68,
    speed: (.23 + noise(i + 3) * .39) * (noise(i + 81) > .35 ? 1 : -1),
    phase: noise(i + 12) * TAU,
    wobble: .6 + noise(i + 41) * .9,
    scale: .68 + noise(i + 23) * .32,
    variant: i % PALETTES.length,
}));

let sprites: HTMLCanvasElement[][] | undefined;

/** Rasterize the detailed insect only once; each live beetle is one drawImage. */
function getSprites(): HTMLCanvasElement[][] {
    if (sprites) return sprites;
    sprites = PALETTES.map(([dark, shell, shine]) => Array.from({ length: FRAMES }, (_, frame) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = SIZE * 2;
        const ctx = canvas.getContext('2d')!;
        ctx.scale(2, 2);
        ctx.translate(SIZE / 2, SIZE / 2);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.fillStyle = '#00000036';
        ctx.beginPath(); ctx.ellipse(1, 2, 5, 7, 0, 0, TAU); ctx.fill();
        // Alternating tripods: six knees and feet retain their insect silhouette.
        for (const side of [-1, 1]) {
            for (let leg = 0; leg < 3; leg++) {
                const stride = Math.sin(frame / FRAMES * TAU + leg * Math.PI + (side < 0 ? Math.PI : 0));
                const rootY = -3 + leg * 3;
                const kneeY = rootY + (leg - 1) * 2 + stride * 1.2;
                const footY = kneeY + (leg - 1) * 1.5 + stride;
                ctx.beginPath(); ctx.moveTo(side * 2.5, rootY);
                ctx.lineTo(side * (6 + stride * .5), kneeY);
                ctx.lineTo(side * (8 + stride * .6), footY);
                ctx.strokeStyle = '#101c16'; ctx.lineWidth = 1.6; ctx.stroke();
                ctx.strokeStyle = shell; ctx.lineWidth = .65; ctx.stroke();
            }
            ctx.beginPath(); ctx.moveTo(side * 1.4, -6);
            ctx.lineTo(side * 3, -8.5); ctx.lineTo(side * 4.5, -10);
            ctx.strokeStyle = shine; ctx.lineWidth = .65; ctx.stroke();
        }
        // Head, pronotum and paired hard wing cases (elytra).
        ctx.fillStyle = '#18251c'; ctx.strokeStyle = '#080f0b'; ctx.lineWidth = .8;
        ctx.beginPath(); ctx.ellipse(0, -5.5, 2.6, 2.4, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = shell;
        ctx.beginPath(); ctx.ellipse(0, -3.2, 3.5, 2, 0, 0, TAU); ctx.fill(); ctx.stroke();
        const gradient = ctx.createLinearGradient(-4, 0, 4, 2);
        gradient.addColorStop(0, dark); gradient.addColorStop(.3, shell);
        gradient.addColorStop(.55, shine); gradient.addColorStop(.72, shell); gradient.addColorStop(1, dark);
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.ellipse(0, 1.6, 4.3, 5.7, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -3.4); ctx.lineTo(0, 6.9);
        ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = '#d9e4b64a'; ctx.lineWidth = .55;
        for (const side of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(side * 2, -1.8);
            ctx.quadraticCurveTo(side * 3.5, 1, side * 2.2, 4.6); ctx.stroke();
        }
        ctx.fillStyle = shine;
        ctx.fillRect(-2, -6.2, .7, .7); ctx.fillRect(1.3, -6.2, .7, .7);
        return canvas;
    }));
    return sprites;
}

/** Dense, independently crawling beetles; simulation time also freezes their gait on pause. */
export function drawBeetleSwarm(ctx: CanvasRenderingContext2D, x: number, y: number,
    elapsedMs: number, radius = 130): void {
    if (radius <= 0) return;
    const atlas = getSprites();
    const t = Math.max(0, elapsedMs) / 1000;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#53694709';
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill();
    // A quiet, broken boundary communicates reach without enclosing the swarm in a neon ring.
    ctx.strokeStyle = '#82977120'; ctx.lineWidth = 1;
    ctx.setLineDash([9, 17]); ctx.stroke(); ctx.setLineDash([]);
    for (const bug of beetles) {
        const oscillation = t * bug.wobble + bug.phase;
        const r = radius * (bug.distance + .045 * Math.sin(oscillation));
        const angle = bug.angle + t * bug.speed + .12 * Math.sin(oscillation * .7);
        const radialVelocity = radius * .045 * bug.wobble * Math.cos(oscillation);
        const angularVelocity = bug.speed + .084 * bug.wobble * Math.cos(oscillation * .7);
        const ca = Math.cos(angle), sa = Math.sin(angle);
        const vx = radialVelocity * ca - r * sa * angularVelocity;
        const vy = radialVelocity * sa + r * ca * angularVelocity;
        const frame = Math.floor(t * (11 + bug.wobble * 3) + bug.phase * 3) % FRAMES;
        const size = SIZE * bug.scale;
        ctx.save(); ctx.translate(ca * r, sa * r);
        ctx.rotate(Math.atan2(vy, vx) + Math.PI / 2);
        ctx.drawImage(atlas[bug.variant][frame], -size / 2, -size / 2, size, size);
        ctx.restore();
    }
    ctx.restore();
}
