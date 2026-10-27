interface BloodShape {
    x: number;
    y: number;
    size: number;
    stretch: number;
    rotation: number;
    color: string;
    contour: Float64Array;
}

interface BloodParticle extends BloodShape {
    vx: number;
    vy: number;
    landingX: number;
    landingY: number;
    duration: number;
    height: number;
    spin: number;
    chunk: boolean;
    bone: boolean;
}

// Quadratic joins keep irregular fluid lobes without turning them into star-shaped shards.
function fillContour(ctx: CanvasRenderingContext2D, points: Float64Array): void {
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

function makeContour(random: () => number): Float64Array {
    const contour = new Float64Array(24);
    for (let i = 0; i < 12; i++) {
        const theta = i / 12 * Math.PI * 2;
        const reach = .6 + random() * .65;
        contour[i * 2] = Math.cos(theta) * reach;
        contour[i * 2 + 1] = Math.sin(theta) * reach;
    }
    return contour;
}

function drawShape(ctx: CanvasRenderingContext2D, shape: BloodShape,
    x = shape.x, y = shape.y, rotation = shape.rotation, color = shape.color): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(shape.size * shape.stretch, shape.size);
    ctx.fillStyle = color;
    fillContour(ctx, shape.contour);
    ctx.restore();
}

// Smooth, deterministic pigment variation: no animated noise or random flicker.
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

/** A dense directional splash and remains, with a permanent ground imprint. */
export class ZombieDeathEffect {
    private ageMs = 0;
    private readonly particles: BloodParticle[] = [];
    private readonly groundShapes: BloodShape[] = [];
    private readonly trails: BloodShape[] = [];
    private readonly lifetimeMs = 650;
    private readonly drag = 4.5;
    private groundDecal: { canvas: HTMLCanvasElement; x: number; y: number } | null = null;
    private readonly bloodColor: string;
    private readonly greenBlood: boolean;

    constructor(
        private readonly x: number,
        private readonly y: number,
        radius: number,
        angle: number,
        palette: readonly string[],
        random: () => number = Math.random,
    ) {
        const scale = Math.max(8, radius);
        const trailLengthScale = .7;
        const colors = palette.length ? palette : ['#781014', '#a0181c', '#b71b21'];
        this.bloodColor = colors[Math.min(1, colors.length - 1)];
        this.greenBlood = parseInt(this.bloodColor.slice(3, 5), 16) > parseInt(this.bloodColor.slice(1, 3), 16);
        const color = () => colors[Math.min(colors.length - 1, Math.floor(random() * colors.length))];
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const length = scale * (7.2 + random() * 1.6);
        // A single connected liquid ribbon carries the blood away from the shooter.
        // Two overlapping irregular layers provide dark edges and a saturated wet core.
        for (let layer = 0; layer < 2; layer++) {
            const count = 24;
            const contour = new Float64Array(count * 4);
            for (let side = 0; side < 2; side++) {
                for (let j = 0; j < count; j++) {
                    const i = side === 0 ? j : count - 1 - j;
                    const t = i / (count - 1);
                    const forward = (-scale * .62 + t * length * (layer ? .94 : 1)) * trailLengthScale;
                    const width = scale * (1.05 - t * .85) * (layer ? .7 : 1)
                        * (.7 + random() * .65);
                    const bend = Math.sin(t * Math.PI * 2.4) * scale * .16;
                    const index = (side * count + j) * 2;
                    contour[index] = forward;
                    contour[index + 1] = bend + (side ? -width : width);
                }
            }
            this.trails.push({ x: 0, y: 0, size: 1, stretch: 1, rotation: angle,
                color: colors[layer % colors.length], contour });
        }
        // Dense joined patches break up the ribbon edges; distal drops become smaller.
        for (let i = 0; i < 155; i++) {
            const t = random();
            const forward = (i < 36 ? random() * 1.4 - .6 : t * 9.2) * scale * trailLengthScale;
            const spread = (i < 36 ? .95 : .28 + t * .95) * scale;
            const lateral = (random() - .5) * 2 * spread;
            this.groundShapes.push({
                x: cos * forward - sin * lateral,
                y: sin * forward + cos * lateral,
                size: scale * (i < 36 ? .16 + random() * .35 : .025 + random() * .13),
                stretch: 1.1 + random() * 1.5,
                rotation: angle + (random() - .5) * .8,
                color: color(), contour: makeContour(random),
            });
        }
        for (let i = 0; i < 105; i++) {
            const chunk = i >= 91;
            const forward = scale * (i === 91 ? .32 : chunk ? .2 + random() * 3.1 : .1 + random() * 8.8);
            const lateral = (random() - .5) * scale * (chunk ? 1.65 : 1.5 + forward / scale * .22);
            const landingX = cos * forward * trailLengthScale - sin * lateral;
            const landingY = sin * forward * trailLengthScale + cos * lateral;
            const duration = .26 + random() * .32;
            const distanceTime = (1 - Math.exp(-this.drag * duration)) / this.drag;
            this.particles.push({
                x: 0, y: 0, vx: landingX / distanceTime, vy: landingY / distanceTime,
                landingX, landingY, duration,
                height: scale * (.2 + random() * (chunk ? 1.4 : .7)),
                size: scale * (i === 91 ? .36 : chunk ? .13 + random() * .16 : .035 + random() * .12),
                stretch: chunk ? 1.2 + random() * .7 : 1.3 + random() * 1.2,
                rotation: angle + (random() - .5) * (chunk ? 6 : .8),
                spin: (random() - .5) * 12,
                color: chunk ? (i % 3 ? '#30382a' : '#49392d') : color(),
                chunk, bone: chunk && i % 4 === 0, contour: makeContour(random),
            });
        }
    }

    get isExpired(): boolean { return this.ageMs >= this.lifetimeMs; }

    update(deltaMs: number): void {
        if (Number.isFinite(deltaMs) && deltaMs > 0) this.ageMs += deltaMs;
    }

    private drawBlood(ctx: CanvasRenderingContext2D, mask = false): void {
        for (const shape of [...this.trails, ...this.groundShapes]) {
            drawShape(ctx, shape, shape.x, shape.y, shape.rotation, mask ? '#fff' : shape.color);
        }
        for (const particle of this.particles) {
            if (!particle.chunk) drawShape(ctx, particle, particle.landingX, particle.landingY,
                particle.rotation, mask ? '#fff' : particle.color);
        }
    }

    private createGroundDecal(): void {
        if (typeof document === 'undefined') return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const include = (shape: BloodShape, x: number, y: number) => {
            const cos = Math.cos(shape.rotation), sin = Math.sin(shape.rotation);
            for (let i = 0; i < shape.contour.length; i += 2) {
                const px = shape.contour[i] * shape.size * shape.stretch;
                const py = shape.contour[i + 1] * shape.size;
                const dx = x + px * cos - py * sin, dy = y + px * sin + py * cos;
                minX = Math.min(minX, dx); maxX = Math.max(maxX, dx);
                minY = Math.min(minY, dy); maxY = Math.max(maxY, dy);
            }
        };
        for (const shape of [...this.trails, ...this.groundShapes]) include(shape, shape.x, shape.y);
        for (const particle of this.particles) if (!particle.chunk) include(particle, particle.landingX, particle.landingY);
        const left = Math.floor(minX) - 3, top = Math.floor(minY) - 3;
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(maxX) - left + 3;
        canvas.height = Math.ceil(maxY) - top + 3;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.translate(-left, -top);
        this.drawBlood(ctx, true);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = pixels.data;
        const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
        for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
        const rgb = [1, 3, 5].map(offset => parseInt(this.bloodColor.slice(offset, offset + 2), 16));
        const seed = Math.imul(Math.round(this.x * 31 + this.y * 113), 1597334677);
        for (let y = 1; y < canvas.height - 1; y++) {
            for (let x = 1; x < canvas.width - 1; x++) {
                const i = y * canvas.width + x, p = i * 4;
                if (!alpha[i]) continue;
                const wx = x + left, wy = y + top;
                const pool = pigmentNoise(wx / 19, wy / 19, seed);
                const clot = pigmentNoise(wx / 5, wy / 5, seed + 47);
                const grain = pigmentNoise(wx / 1.2, wy / 1.2, seed + 311);
                // One continuous pigment field merges overlapping lobes into liquid.
                // Thin translucent edges surround deep, irregular coagulated pockets.
                const edge = (alpha[i - 1] + alpha[i + 1] + alpha[i - canvas.width] + alpha[i + canvas.width]) / 1020;
                const depth = .49 + pool * .49 + clot * .16 + (grain - .5) * .13;
                const pocket = Math.max(0, .43 - clot) * .75;
                const glint = Math.max(0, grain - .71) * Math.max(0, clot - .52) * 75;
                data[p] = rgb[0] * (depth - pocket) + glint;
                data[p + 1] = rgb[1] * (depth - pocket) + glint * .72;
                data[p + 2] = rgb[2] * (depth - pocket) + glint * .63;
                data[p + 3] = alpha[i] * (.64 + pool * .29 + clot * .07) * (.66 + edge * .34);
            }
        }
        ctx.putImageData(pixels, 0, 0);
        this.groundDecal = { canvas, x: left, y: top };
    }

    private drawRemains(ctx: CanvasRenderingContext2D, particle: BloodParticle,
        x: number, y: number, rotation: number): void {
        ctx.save();
        ctx.globalAlpha *= .42;
        drawShape(ctx, particle, x + .3, y + .55, rotation, '#211a17');
        ctx.restore();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.scale(particle.size * particle.stretch * .98, particle.size * .92);
        const flesh = ctx.createLinearGradient(-.7, -.8, .7, .8);
        if (flesh && typeof flesh.addColorStop === 'function') {
            flesh.addColorStop(0, this.greenBlood ? '#626046' : '#815044');
            flesh.addColorStop(.3, this.greenBlood ? '#3e492a' : '#54201e');
            flesh.addColorStop(.7, this.greenBlood ? '#242b17' : '#2c1113');
            flesh.addColorStop(1, '#151412');
            ctx.fillStyle = flesh;
        } else ctx.fillStyle = this.greenBlood ? '#343b24' : '#491b1d';
        fillContour(ctx, particle.contour);
        ctx.clip();
        // Fine torn fibres and mottled tissue break up the clean gradient surface.
        for (let i = 0; i < 42; i++) {
            const px = pigmentNoise(i * 13.7, particle.contour[0] * 91, 71) * 2 - 1;
            const py = pigmentNoise(i * 7.3, particle.contour[1] * 83, 97) * 2 - 1;
            ctx.strokeStyle = i % 3 === 0
                ? (this.greenBlood ? '#64654a' : '#885049')
                : (this.greenBlood ? '#29321e' : '#3b161b');
            ctx.lineWidth = .025 + (i % 4) * .012;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + .04 + (i % 3) * .035, py + .03);
            ctx.stroke();
        }
        ctx.strokeStyle = this.greenBlood ? '#242719' : '#301214';
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

    drawGround(ctx: CanvasRenderingContext2D): void {
        // Stamped once on the persistent arena canvas; independent of effect age.
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = .98;
        if (!this.groundDecal) this.createGroundDecal();
        if (this.groundDecal) ctx.drawImage(this.groundDecal.canvas, this.groundDecal.x, this.groundDecal.y);
        else this.drawBlood(ctx);
        for (const particle of this.particles) {
            if (particle.chunk) this.drawRemains(ctx, particle,
                particle.landingX, particle.landingY, particle.rotation);
        }
        ctx.restore();
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (this.isExpired) return;
        const seconds = this.ageMs / 1000;
        const distanceTime = (1 - Math.exp(-this.drag * seconds)) / this.drag;
        const tailSeconds = Math.max(0, seconds - .035);
        const tailDistanceTime = (1 - Math.exp(-this.drag * tailSeconds)) / this.drag;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.lineCap = 'round';
        ctx.globalAlpha = .98;
        for (const particle of this.particles) {
            if (seconds >= particle.duration) continue;
            const progress = seconds / particle.duration;
            const x = particle.vx * distanceTime;
            const y = particle.vy * distanceTime - Math.sin(progress * Math.PI) * particle.height;
            if (particle.chunk) {
                this.drawRemains(ctx, particle, x, y, particle.rotation + particle.spin * seconds);
            } else {
                const tailY = particle.vy * tailDistanceTime
                    - Math.sin(tailSeconds / particle.duration * Math.PI) * particle.height;
                ctx.strokeStyle = particle.color;
                ctx.lineWidth = particle.size * 1.5;
                ctx.beginPath();
                ctx.moveTo(particle.vx * tailDistanceTime, tailY);
                ctx.lineTo(x, y);
                ctx.stroke();
                drawShape(ctx, particle, x, y);
                ctx.save();
                ctx.translate(x + particle.size * .12, y + particle.size * .18);
                ctx.scale(.65, .65);
                drawShape(ctx, particle, 0, 0, particle.rotation, this.greenBlood ? '#283c1c' : '#650e17');
                ctx.restore();
            }
        }
        ctx.restore();
    }
}
