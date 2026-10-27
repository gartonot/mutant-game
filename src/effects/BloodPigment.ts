// Per-decal lattice: each deterministic hash is calculated once rather than four
// times for every covered pixel. Float64 and the original operation order keep
// the pigment field identical, including negative world coordinates.
class PigmentLattice {
    private readonly hashes: Float64Array;
    private readonly columns: Int32Array;
    private readonly rows: Int32Array;
    private readonly smoothX: Float64Array;
    private readonly smoothY: Float64Array;
    private readonly stride: number;

    constructor(width: number, height: number, left: number, top: number, scale: number, seed: number) {
        const minX = Math.floor(left / scale), minY = Math.floor(top / scale);
        this.stride = Math.floor((width - 1 + left) / scale) - minX + 2;
        const latticeHeight = Math.floor((height - 1 + top) / scale) - minY + 2;
        this.hashes = new Float64Array(this.stride * latticeHeight);
        for (let y = 0; y < latticeHeight; y++) {
            for (let x = 0; x < this.stride; x++) {
                let h = Math.imul(x + minX, 374761393) ^ Math.imul(y + minY, 668265263) ^ seed;
                h = Math.imul(h ^ (h >>> 13), 1274126177);
                this.hashes[y * this.stride + x] = ((h ^ (h >>> 16)) >>> 0) / 4294967295;
            }
        }
        this.columns = new Int32Array(width);
        this.rows = new Int32Array(height);
        this.smoothX = new Float64Array(width);
        this.smoothY = new Float64Array(height);
        for (let x = 0; x < width; x++) {
            const value = (x + left) / scale, integer = Math.floor(value), fraction = value - integer;
            this.columns[x] = integer - minX;
            this.smoothX[x] = fraction * fraction * (3 - 2 * fraction);
        }
        for (let y = 0; y < height; y++) {
            const value = (y + top) / scale, integer = Math.floor(value), fraction = value - integer;
            this.rows[y] = (integer - minY) * this.stride;
            this.smoothY[y] = fraction * fraction * (3 - 2 * fraction);
        }
    }

    sample(x: number, y: number): number {
        const i = this.rows[y] + this.columns[x], sx = this.smoothX[x], sy = this.smoothY[y];
        const top = this.hashes[i] * (1 - sx) + this.hashes[i + 1] * sx;
        const bottom = this.hashes[i + this.stride] * (1 - sx) + this.hashes[i + this.stride + 1] * sx;
        return top * (1 - sy) + bottom * sy;
    }
}

/** Colorize an alpha mask without changing the original procedural pigment. */
export function colorizeBloodPixels(data: Uint8ClampedArray, width: number, height: number,
    left: number, top: number, rgb: readonly number[], seed: number): void {
    if (width < 3 || height < 3) return;
    const alpha = new Uint8ClampedArray(width * height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
    const pools = new PigmentLattice(width, height, left, top, 19, seed);
    const clots = new PigmentLattice(width, height, left, top, 5, seed + 47);
    const grains = new PigmentLattice(width, height, left, top, 1.2, seed + 311);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x, p = i * 4;
            if (!alpha[i]) continue;
            const pool = pools.sample(x, y), clot = clots.sample(x, y), grain = grains.sample(x, y);
            const edge = (alpha[i - 1] + alpha[i + 1] + alpha[i - width] + alpha[i + width]) / 1020;
            const depth = .49 + pool * .49 + clot * .16 + (grain - .5) * .13;
            const pocket = Math.max(0, .43 - clot) * .75;
            const glint = Math.max(0, grain - .71) * Math.max(0, clot - .52) * 75;
            data[p] = rgb[0] * (depth - pocket) + glint;
            data[p + 1] = rgb[1] * (depth - pocket) + glint * .72;
            data[p + 2] = rgb[2] * (depth - pocket) + glint * .63;
            data[p + 3] = alpha[i] * (.64 + pool * .29 + clot * .07) * (.66 + edge * .34);
        }
    }
}
