type GlowPalette = 'gold' | 'cyan';
const textures = new Map<string, HTMLCanvasElement>();

/** Small shared textures keep animated loot lighting independent of drop count. */
function texture(palette: GlowPalette, rays: boolean): HTMLCanvasElement {
    const key = `${palette}-${rays}`;
    const cached = textures.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const color = palette === 'gold' ? '255,210,75' : '65,185,255';
    ctx.translate(128, 128);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 124);
    gradient.addColorStop(0, `rgba(${palette === 'gold' ? '255,245,190' : '180,245,255'},.8)`);
    gradient.addColorStop(.18, `rgba(${color},.5)`);
    gradient.addColorStop(.48, `rgba(${color},.2)`);
    gradient.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = gradient;
    if (rays) {
        ctx.filter = 'blur(2px)';
        for (let i = 0; i < 19; i++) {
            const angle = i * Math.PI * 2 / 19;
            const length = 88 + 34 * (.5 + .5 * Math.sin(i * 7.3));
            const spread = .025 + .035 * (.5 + .5 * Math.cos(i * 3.7));
            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.arc(0, 0, length, angle - spread, angle + spread);
            ctx.closePath(); ctx.fill();
        }
    } else {
        ctx.fillRect(-128, -128, 256, 256);
    }
    textures.set(key, canvas);
    return canvas;
}

/** Draw behind the item, in world pixels, with a broad halo and drifting light rays. */
export function drawPickupGlow(ctx: CanvasRenderingContext2D, refill: boolean,
    width: number, ageMs: number, phase: number): void {
    if (typeof document === 'undefined') return;
    const palette = refill ? 'cyan' : 'gold';
    const time = ageMs / 1000 + phase;
    const pulse = 1 + Math.sin(time * 2.1) * .045;
    const size = width * (refill ? .82 : 1.18) * pulse;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= .72 + Math.sin(time * 1.7) * .1;
    ctx.translate(0, -4);
    ctx.drawImage(texture(palette, false), -size / 2, -size * .36, size, size * .72);
    ctx.scale(1, .72);
    ctx.rotate(Math.sin(time * .45) * .12);
    ctx.drawImage(texture(palette, true), -size / 2, -size / 2, size, size);
    ctx.globalAlpha *= .45;
    ctx.rotate(-time * .12);
    ctx.drawImage(texture(palette, true), -size / 2, -size / 2, size, size);
    ctx.restore();
}
