import { colorizeBloodPixels } from './BloodPigment';
import type { BloodRemainsInput } from './BloodRemains';

export interface BloodDecalShape {
    x: number; y: number; size: number; stretch: number; rotation: number; contour: Float64Array;
}
export interface BloodDecalInput { shapes: BloodDecalShape[]; color: string; seed: number; remains?: BloodRemainsInput }
export interface BloodDecal { canvas: HTMLCanvasElement | OffscreenCanvas | ImageBitmap; x: number; y: number }

/** Shared by the worker and synchronous fallback, with identical drawing and pixel math. */
export function renderBloodDecal(input: BloodDecalInput, canvas: HTMLCanvasElement | OffscreenCanvas): BloodDecal | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const shape of input.shapes) {
        const cos = Math.cos(shape.rotation), sin = Math.sin(shape.rotation);
        for (let i = 0; i < shape.contour.length; i += 2) {
            const px = shape.contour[i] * shape.size * shape.stretch;
            const py = shape.contour[i + 1] * shape.size;
            const dx = shape.x + px * cos - py * sin, dy = shape.y + px * sin + py * cos;
            minX = Math.min(minX, dx); maxX = Math.max(maxX, dx);
            minY = Math.min(minY, dy); maxY = Math.max(maxY, dy);
        }
    }
    if (!Number.isFinite(minX)) return null;
    const left = Math.floor(minX) - 3, top = Math.floor(minY) - 3;
    canvas.width = Math.ceil(maxX) - left + 3;
    canvas.height = Math.ceil(maxY) - top + 3;
    // Both 2D contexts implement all operations used below.
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) return null;
    ctx.translate(-left, -top);
    for (const shape of input.shapes) {
        ctx.save();
        ctx.translate(shape.x, shape.y);
        ctx.rotate(shape.rotation);
        ctx.scale(shape.size * shape.stretch, shape.size);
        ctx.fillStyle = '#fff';
        const points = shape.contour, end = points.length - 2;
        ctx.beginPath();
        ctx.moveTo((points[end] + points[0]) / 2, (points[end + 1] + points[1]) / 2);
        for (let i = 0; i < points.length; i += 2) {
            const next = (i + 2) % points.length;
            ctx.quadraticCurveTo(points[i], points[i + 1],
                (points[i] + points[next]) / 2, (points[i + 1] + points[next + 1]) / 2);
        }
        ctx.closePath(); ctx.fill(); ctx.restore();
    }
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rgb = [1, 3, 5].map(offset => parseInt(input.color.slice(offset, offset + 2), 16));
    colorizeBloodPixels(pixels.data, canvas.width, canvas.height, left, top, rgb, input.seed);
    ctx.putImageData(pixels, 0, 0);
    return { canvas, x: left, y: top };
}
