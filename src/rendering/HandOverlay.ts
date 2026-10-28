type Rect = readonly [number, number, number, number];
type Finger = readonly [number, number, number, number];

/** Copy clipped sprite regions over the weapon (fingers, or an optional crown), in body coordinates. */
export function drawHandOverlay(ctx: CanvasRenderingContext2D, atlas: CanvasImageSource,
    source: Rect, target: Rect, fingers: readonly Finger[], rotation: number, recoil: number) {
    ctx.save(); ctx.translate(-recoil, 0); ctx.rotate(rotation);
    ctx.beginPath();
    for (const [x, y, rx, ry] of fingers) {
        ctx.moveTo(x + rx, y); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    }
    ctx.clip(); ctx.drawImage(atlas, ...source, ...target); ctx.restore();
}
