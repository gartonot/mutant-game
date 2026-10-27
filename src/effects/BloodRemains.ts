export interface BloodRemainsParticle {
    contour: Float64Array;
    size: number;
    stretch: number;
    bone: boolean;
}

export interface BloodRemainsInput {
    particles: BloodRemainsParticle[];
    greenBlood: boolean;
    resolution: number;
}

export interface BloodRemainsTile {
    sx: number;
    width: number;
    height: number;
    left: number;
    top: number;
    resolution: number;
}

type RemainsContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function fillContour(ctx: RemainsContext, points: Float64Array): void {
    const end = points.length - 2;
    ctx.beginPath();
    ctx.moveTo((points[end] + points[0]) / 2, (points[end + 1] + points[1]) / 2);
    for (let i = 0; i < points.length; i += 2) {
        const next = (i + 2) % points.length;
        ctx.quadraticCurveTo(points[i], points[i + 1],
            (points[i] + points[next]) / 2, (points[i + 1] + points[next + 1]) / 2);
    }
    ctx.closePath();
    ctx.fill();
}

function pigmentNoise(x: number, y: number, seed: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    const hash = (a: number, b: number) => {
        let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    };
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const top = hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx;
    const bottom = hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx;
    return top * (1 - sy) + bottom * sy;
}

export function drawRemainsFlesh(ctx: RemainsContext, particle: BloodRemainsParticle, greenBlood: boolean,
    x: number, y: number, rotation: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(particle.size * particle.stretch * .98, particle.size * .92);
    const flesh = ctx.createLinearGradient(-.7, -.8, .7, .8);
    if (flesh && typeof flesh.addColorStop === 'function') {
        flesh.addColorStop(0, greenBlood ? '#626046' : '#815044');
        flesh.addColorStop(.3, greenBlood ? '#3e492a' : '#54201e');
        flesh.addColorStop(.7, greenBlood ? '#242b17' : '#2c1113');
        flesh.addColorStop(1, '#151412');
        ctx.fillStyle = flesh;
    } else ctx.fillStyle = greenBlood ? '#343b24' : '#491b1d';
    fillContour(ctx, particle.contour);
    ctx.clip();
    // Fine torn fibres and mottled tissue break up the clean gradient surface.
    for (let i = 0; i < 42; i++) {
        const px = pigmentNoise(i * 13.7, particle.contour[0] * 91, 71) * 2 - 1;
        const py = pigmentNoise(i * 7.3, particle.contour[1] * 83, 97) * 2 - 1;
        ctx.strokeStyle = i % 3 === 0
            ? (greenBlood ? '#64654a' : '#885049')
            : (greenBlood ? '#29321e' : '#3b161b');
        ctx.lineWidth = .025 + (i % 4) * .012;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + .04 + (i % 3) * .035, py + .03);
        ctx.stroke();
    }
    ctx.strokeStyle = greenBlood ? '#242719' : '#301214';
    ctx.lineWidth = .045;
    for (let i = 0; i < 6; i++) {
        const px = particle.contour[i * 2] * .55, py = particle.contour[i * 2 + 1] * .55;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px * .3 - .1, py * .6, px * .2, py * .2 + .12);
        ctx.stroke();
    }
    if (particle.bone) {
        ctx.strokeStyle = '#8f816c';
        ctx.lineWidth = .11;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-.3, -.1);
        ctx.quadraticCurveTo(0, -.22, .46, .04);
        ctx.stroke();
    }
    ctx.restore();
}

/** Rasterize every supplied unique fragment without additional random calls. */
export function renderRemainsAtlas(input: BloodRemainsInput, canvas: HTMLCanvasElement | OffscreenCanvas):
    { canvas: HTMLCanvasElement | OffscreenCanvas; tiles: BloodRemainsTile[] } | null {
    const { particles, greenBlood, resolution } = input;
    const tiles: BloodRemainsTile[] = [];
    let width = 0, height = 0;
    for (const particle of particles) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < particle.contour.length; i += 2) {
            const x = particle.contour[i] * particle.size * particle.stretch * .98;
            const y = particle.contour[i + 1] * particle.size * .92;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
        const left = Math.floor(minX) - 2, top = Math.floor(minY) - 2;
        const tileWidth = Math.ceil((maxX - left + 2) * resolution);
        const tileHeight = Math.ceil((maxY - top + 2) * resolution);
        tiles.push({ sx: width, width: tileWidth, height: tileHeight, left, top, resolution });
        width += tileWidth;
        height = Math.max(height, tileHeight);
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as RemainsContext | null;
    if (!ctx) return null;
    for (let i = 0; i < particles.length; i++) {
        const tile = tiles[i];
        ctx.save();
        ctx.translate(tile.sx, 0);
        ctx.scale(resolution, resolution);
        ctx.translate(-tile.left, -tile.top);
        ctx.globalAlpha = .98;
        drawRemainsFlesh(ctx, particles[i], greenBlood, 0, 0, 0);
        ctx.restore();
    }
    return { canvas, tiles };
}
