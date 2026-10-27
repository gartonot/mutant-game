/** Earliest segment-circle contact, including a projectile starting inside the target. */
export function segmentHit(x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, radius: number): number | null {
    const dx = x1 - x0, dy = y1 - y0, ox = x0 - cx, oy = y0 - cy;
    const c = ox * ox + oy * oy - radius * radius;
    if (c <= 0) return 0;
    const a = dx * dx + dy * dy;
    if (a === 0) return null;
    const b = ox * dx + oy * dy;
    const discriminant = b * b - a * c;
    if (discriminant < 0) return null;
    const t = (-b - Math.sqrt(discriminant)) / a;
    return t >= 0 && t <= 1 ? t : null;
}
