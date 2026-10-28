const TAU = Math.PI * 2;
const FRAME_COUNT = 32;
const SPRITE_WIDTH = 96;
const SPRITE_HEIGHT = 128;

function noise(seed: number): number {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
}

const flames = Array.from({ length: 38 }, (_, i) => {
    const angle = i * 2.399963;
    const distance = Math.sqrt((i + .5) / 38) * .88;
    return {
        x: Math.cos(angle + (noise(i + 61) - .5) * .22) * distance,
        y: Math.sin(angle + (noise(i + 61) - .5) * .22) * distance,
        phase: noise(i + 9),
        speed: .65 + noise(i + 21) * .4,
        size: .72 + noise(i + 81) * .45,
        variant: i % 3,
    };
}).sort((a, b) => a.y - b.y);

let sprites: HTMLCanvasElement[][] | undefined;
let groundGlow: HTMLCanvasElement | undefined;

/** Soft raster flame frames are cached: no live blur passes or per-particle gradients. */
function getSprites(): HTMLCanvasElement[][] {
    if (sprites) return sprites;
    sprites = Array.from({ length: 3 }, (_, variant) => Array.from({ length: FRAME_COUNT }, (_, frame) => {
        const canvas = document.createElement('canvas');
        canvas.width = SPRITE_WIDTH; canvas.height = SPRITE_HEIGHT;
        const ctx = canvas.getContext('2d')!;
        const phase = frame / FRAME_COUNT * TAU;
        const bend = Math.sin(phase + variant * 2.1) * 13;
        const height = 66 + Math.sin(phase * 2 + variant) * 10;
        ctx.translate(48, 111);
        const halo = ctx.createRadialGradient(0, -23, 2, 0, -23, 46);
        halo.addColorStop(0, '#ff661b50');
        halo.addColorStop(.5, '#f344121b');
        halo.addColorStop(1, '#b7190000');
        ctx.fillStyle = halo; ctx.fillRect(-48, -111, 96, 128);

        const tongue = (width: number, tall: number, lean: number, core: boolean) => {
            const gradient = ctx.createLinearGradient(0, 3, 0, -tall);
            gradient.addColorStop(0, core ? '#fff9cce8' : '#ffcb4ce0');
            gradient.addColorStop(.25, core ? '#ffe66bd9' : '#ff9b20c9');
            gradient.addColorStop(.6, core ? '#ffb12b99' : '#ff531e9c');
            gradient.addColorStop(1, '#ed300000');
            ctx.fillStyle = gradient;
            ctx.beginPath(); ctx.moveTo(-width * .65, 2);
            ctx.bezierCurveTo(-width * 1.2, -tall * .2, -width * .28 + lean * .3, -tall * .43, lean * .15, -tall * .59);
            ctx.bezierCurveTo(lean * .8 + width * .26, -tall * .76, lean * 1.3 - width * .2, -tall * .87, lean, -tall);
            ctx.bezierCurveTo(lean + width * .6, -tall * .72, width * .22 - lean * .5, -tall * .55, width * .58, -tall * .38);
            ctx.bezierCurveTo(width * 1.1, -tall * .18, width * .7, 4, -width * .65, 2);
            ctx.fill();
        };
        ctx.filter = 'blur(2px)';
        tongue(18, height, bend, false);
        ctx.save(); ctx.translate(-11, 0);
        tongue(8, height * .67, -bend * .8 - 7, false); ctx.restore();
        ctx.filter = 'blur(1.2px)';
        tongue(7, height * .48, bend * .5, true);
        ctx.filter = 'none';
        return canvas;
    }));
    return sprites;
}

function getGlow(): HTMLCanvasElement {
    if (groundGlow) return groundGlow;
    groundGlow = document.createElement('canvas');
    groundGlow.width = groundGlow.height = 128;
    const ctx = groundGlow.getContext('2d')!;
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, '#ff901d55');
    gradient.addColorStop(.35, '#eb53162c');
    gradient.addColorStop(1, '#b82c0000');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    return groundGlow;
}

/** A bed of individual, curling flames; all motion follows simulation time. */
export function drawPyrokinesisFire(ctx: CanvasRenderingContext2D, x: number, y: number,
    elapsedMs: number, radius = 125): void {
    if (radius <= 0) return;
    const time = Math.max(0, elapsedMs) / 1000;
    const fadeIn = Math.min(1, time / .2);
    const frames = getSprites();
    const glow = getGlow();
    ctx.save(); ctx.translate(x, y);
    const alpha = ctx.globalAlpha * fadeIn;
    ctx.globalCompositeOperation = 'lighter';
    // Overlapping irregular pools of heat leave the arena floor visible.
    ctx.globalAlpha = alpha * .65;
    for (let i = 0; i < flames.length; i += 3) {
        const flame = flames[i];
        const size = radius * (.5 + flame.size * .15);
        ctx.drawImage(glow, flame.x * radius - size / 2, flame.y * radius - size * .3, size, size * .6);
    }
    for (const flame of flames) {
        const cycle = time * flame.speed + flame.phase;
        const frame = Math.floor((cycle % 1) * FRAME_COUNT);
        const breath = .92 + Math.sin(cycle * TAU) * .08;
        const width = radius * .78 * flame.size;
        const height = radius * .96 * flame.size * breath;
        const px = flame.x * radius + Math.sin(time * 1.7 + flame.phase * TAU) * 2.5;
        const py = flame.y * radius;
        ctx.globalAlpha = alpha * (.48 + flame.size * .12);
        ctx.drawImage(frames[flame.variant][frame], px - width / 2, py - height * .867, width, height);
    }
    // Sparse rising sparks rather than a decorative dotted perimeter.
    ctx.lineCap = 'round';
    for (let i = 0; i < 13; i++) {
        const flame = flames[(i * 7) % flames.length];
        const life = (time * (.36 + noise(i + 31) * .2) + noise(i + 11)) % 1;
        const px = flame.x * radius + Math.sin(life * 4 + i) * 9 + life * 8;
        const py = flame.y * radius - 12 - life * 65;
        ctx.globalAlpha = alpha * Math.sin(life * Math.PI) * .75;
        ctx.strokeStyle = i % 3 === 0 ? '#fff2a4' : '#ffb142';
        ctx.lineWidth = .8 + noise(i + 20) * .7;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - .7, py + 2 + life * 2); ctx.stroke();
    }
    ctx.restore();
}
