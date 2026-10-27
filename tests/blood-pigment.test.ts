import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colorizeBloodPixels } from '../src/effects/BloodPigment';

// Frozen pre-optimization algorithm: independently recompute all four hashes
// at every sample, so the comparison catches lattice indexing/rounding changes.
function noise(x: number, y: number, seed: number): number {
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

export function legacyColorize(data: Uint8ClampedArray, width: number, height: number,
    left: number, top: number, rgb: readonly number[], seed: number): void {
    const alpha = new Uint8ClampedArray(width * height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x, p = i * 4;
            if (!alpha[i]) continue;
            const wx = x + left, wy = y + top;
            const pool = noise(wx / 19, wy / 19, seed);
            const clot = noise(wx / 5, wy / 5, seed + 47);
            const grain = noise(wx / 1.2, wy / 1.2, seed + 311);
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

test('blood pigment lattice exactly matches legacy RGBA across bounds, palettes, alpha and seeds', () => {
    let state = 10231;
    const randomByte = () => { state = (Math.imul(state, 1664525) + 1013904223) | 0; return state >>> 24; };
    for (const [width, height] of [[1, 1], [2, 6], [3, 3], [37, 89], [211, 94], [317, 283]]) {
        for (const [left, top] of [[0, 0], [-127, -309], [91, -51], [-.5, 2.7]]) {
            for (const seed of [0, -2147483648, 2147483647, 983418215]) {
                for (const rgb of [[160, 24, 28], [33, 161, 57]]) {
                    const expected = Uint8ClampedArray.from({ length: width * height * 4 }, randomByte);
                    // Include invisible pixels and fully opaque regions as well as alpha edges.
                    for (let p = 3; p < expected.length; p += 4) {
                        if (p % 7 === 0) expected[p] = 0;
                        if (p % 11 === 0) expected[p] = 255;
                    }
                    const actual = expected.slice();
                    legacyColorize(expected, width, height, left, top, rgb, seed);
                    colorizeBloodPixels(actual, width, height, left, top, rgb, seed);
                    assert.deepEqual(actual, expected, `${width}x${height} at ${left},${top} seed ${seed}`);
                }
            }
        }
    }
});

test('different blood seeds retain distinct pigment fields', () => {
    const a = new Uint8ClampedArray(64 * 64 * 4).fill(255), b = a.slice();
    colorizeBloodPixels(a, 64, 64, -32, -32, [160, 24, 28], 731);
    colorizeBloodPixels(b, 64, 64, -32, -32, [160, 24, 28], 732);
    assert.notDeepEqual(a, b);
});
