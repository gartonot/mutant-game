import { ARENA_BORDER } from '@/gameplay/Arena';

/** Solid concrete perimeter, drawn in world coordinates. */
export function drawArenaBorder(ctx: CanvasRenderingContext2D, width: number, height: number,
    visible: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width, height }): void {
    const thickness = ARENA_BORDER;
    const horizontal = (y: number, inward: number) => {
        if (y + thickness < visible.y || y > visible.y + visible.height) return;
        const left = Math.max(0, Math.floor(visible.x / 160) * 160);
        const right = Math.min(width, visible.x + visible.width + 160);
        ctx.fillStyle = '#141c18'; ctx.fillRect(left, y + inward * 5, right - left, thickness);
        ctx.fillStyle = '#737665'; ctx.fillRect(left, y, right - left, thickness);
        ctx.fillStyle = '#a6a893'; ctx.fillRect(left, y + (inward > 0 ? 0 : thickness - 4), right - left, 4);
        ctx.fillStyle = '#424b40'; ctx.fillRect(left, y + (inward > 0 ? thickness - 7 : 0), right - left, 7);
        ctx.strokeStyle = '#333d32'; ctx.lineWidth = 3;
        for (let x = left; x < right; x += 160) {
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + thickness); ctx.stroke();
            ctx.fillStyle = '#c3b67680'; ctx.fillRect(x + 14, y + thickness / 2 - 3, 22, 6);
        }
    };
    const vertical = (x: number, inward: number) => {
        if (x + thickness < visible.x || x > visible.x + visible.width) return;
        const top = Math.max(0, Math.floor(visible.y / 160) * 160);
        const bottom = Math.min(height, visible.y + visible.height + 160);
        ctx.fillStyle = '#141c18'; ctx.fillRect(x + inward * 5, top, thickness, bottom - top);
        ctx.fillStyle = '#737665'; ctx.fillRect(x, top, thickness, bottom - top);
        ctx.fillStyle = '#a6a893'; ctx.fillRect(x + (inward > 0 ? 0 : thickness - 4), top, 4, bottom - top);
        ctx.fillStyle = '#424b40'; ctx.fillRect(x + (inward > 0 ? thickness - 7 : 0), top, 7, bottom - top);
        ctx.strokeStyle = '#333d32'; ctx.lineWidth = 3;
        for (let y = top; y < bottom; y += 160) {
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + thickness, y); ctx.stroke();
            ctx.fillStyle = '#c3b67680'; ctx.fillRect(x + thickness / 2 - 3, y + 14, 6, 22);
        }
    };
    ctx.save();
    horizontal(0, 1); horizontal(height - thickness, -1);
    vertical(0, 1); vertical(width - thickness, -1);
    ctx.restore();
}
