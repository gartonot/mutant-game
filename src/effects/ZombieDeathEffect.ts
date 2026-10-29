import { drawRemainsFlesh, renderRemainsAtlas } from './BloodRemains';
import type { PreparedBloodDecal } from './BloodDecalWorkerPool';
import { renderBloodDecal, type BloodDecalInput, type BloodDecal } from './BloodDecal';

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

// Reuse the exact same angles for every independently randomized contour.
const contourUnitCircle = Array.from({ length: 12 }, (_, i) => {
    const theta = i / 12 * Math.PI * 2;
    return [Math.cos(theta), Math.sin(theta)] as const;
});

function makeContour(random: () => number): Float64Array {
    const contour = new Float64Array(24);
    for (let i = 0; i < 12; i++) {
        const reach = .6 + random() * .65;
        contour[i * 2] = contourUnitCircle[i][0] * reach;
        contour[i * 2 + 1] = contourUnitCircle[i][1] * reach;
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

/** A dense directional splash and remains, with a permanent ground imprint. */
export class ZombieDeathEffect {
    private ageMs = 0;
    private readonly particles: BloodParticle[] = [];
    private readonly groundShapes: BloodShape[] = [];
    private readonly trails: BloodShape[] = [];
    private readonly lifetimeMs = 650;
    private readonly drag = 4.5;
    private groundDecal: BloodDecal | null = null;
    private remainsAtlas: HTMLCanvasElement | ImageBitmap | null = null;
    private atlasAttempted = false;
    private waitingForPreparation = false;
    private groundStamped = false;
    private retired = false;
    private readonly remainsTiles = new Map<BloodParticle, {
        sx: number; width: number; height: number; left: number; top: number; resolution: number;
    }>();
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
        const colors = palette.length ? palette : ['#703733', '#87423b', '#964c42'];
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
        if (this.waitingForPreparation) return;
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
        this.groundDecal = renderBloodDecal(this.groundInput(), document.createElement('canvas'));
    }

    /** A snapshot of the existing geometry: no new random values or shared templates. */
    groundInput(includeRemains = false): BloodDecalInput {
        return {
            shapes: [...this.trails, ...this.groundShapes,
                ...this.particles.filter(p => !p.chunk).map(p => ({ ...p, x: p.landingX, y: p.landingY }))],
            ...(includeRemains ? { remains: {
                particles: this.particles.filter(p => p.chunk), greenBlood: this.greenBlood,
                resolution: Math.max(3, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1),
            } } : {}),
            color: this.bloodColor,
            seed: Math.imul(Math.round(this.x * 31 + this.y * 113), 1597334677),
        };
    }

    deferUntilPrepared(): void { this.waitingForPreparation = true; }

    /** Apply a worker result only when its ordered ground stamp is about to be drawn. */
    acceptPrepared(prepared: PreparedBloodDecal | null): void {
        this.waitingForPreparation = false;
        if (!prepared?.remains) return;
        this.remainsAtlas = prepared.remains.canvas;
        this.atlasAttempted = true;
        const chunks = this.particles.filter(p => p.chunk);
        prepared.remains.tiles.forEach((tile, index) => this.remainsTiles.set(chunks[index], tile));
    }

    dispose(): void {
        this.retired = true;
        // A capped/expired airborne effect still owes its permanent ground stamp.
        if (!this.groundStamped) return;
        if (this.remainsAtlas && 'close' in this.remainsAtlas) this.remainsAtlas.close();
        this.remainsAtlas = null;
        this.remainsTiles.clear();
    }

    private drawRemains(ctx: CanvasRenderingContext2D, particle: BloodParticle,
        x: number, y: number, rotation: number): void {
        ctx.save();
        ctx.globalAlpha *= .22;
        drawShape(ctx, particle, x + .3, y + .55, rotation, '#211a17');
        ctx.restore();
        if (!this.atlasAttempted) this.createRemainsAtlas();
        const tile = this.remainsTiles.get(particle);
        if (this.remainsAtlas && tile) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            // Respect ground/air opacity when compositing the cached fragment.
            ctx.drawImage(this.remainsAtlas, tile.sx, 0, tile.width, tile.height,
                tile.left, tile.top, tile.width / tile.resolution, tile.height / tile.resolution);
            ctx.restore();
        } else this.drawFlesh(ctx, particle, x, y, rotation);
    }

    private createRemainsAtlas(): void {
        this.atlasAttempted = true;
        if (typeof document === 'undefined') return;
        const chunks = this.particles.filter(p => p.chunk);
        const result = renderRemainsAtlas({ particles: chunks, greenBlood: this.greenBlood,
            resolution: Math.max(3, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1),
        }, document.createElement('canvas'));
        if (!result) return;
        this.remainsAtlas = result.canvas as HTMLCanvasElement;
        result.tiles.forEach((tile, index) => this.remainsTiles.set(chunks[index], tile));
    }

    private drawFlesh(ctx: CanvasRenderingContext2D, particle: BloodParticle,
        x: number, y: number, rotation: number): void {
        drawRemainsFlesh(ctx, particle, this.greenBlood, x, y, rotation);
    }

    drawGround(ctx: CanvasRenderingContext2D, prepared?: BloodDecal | null): void {
        // Stamped once on the persistent arena canvas; independent of effect age.
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha *= .4;
        if (!prepared && !this.groundDecal) this.createGroundDecal();
        const decal = prepared ?? this.groundDecal;
        if (decal) ctx.drawImage(decal.canvas, decal.x, decal.y);
        else this.drawBlood(ctx);
        for (const particle of this.particles) {
            if (particle.chunk) this.drawRemains(ctx, particle,
                particle.landingX, particle.landingY, particle.rotation);
        }
        ctx.restore();
        this.groundStamped = true;
        if (this.retired) this.dispose();
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (this.isExpired || this.waitingForPreparation || this.retired) return;
        const seconds = this.ageMs / 1000;
        const distanceTime = (1 - Math.exp(-this.drag * seconds)) / this.drag;
        const tailSeconds = Math.max(0, seconds - .035);
        const tailDistanceTime = (1 - Math.exp(-this.drag * tailSeconds)) / this.drag;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.lineCap = 'round';
        ctx.globalAlpha *= .6;
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
                drawShape(ctx, particle, 0, 0, particle.rotation, this.greenBlood ? '#283c1c' : '#703733');
                ctx.restore();
            }
        }
        ctx.restore();
    }
}


