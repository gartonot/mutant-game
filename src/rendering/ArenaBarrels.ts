import type { ArenaBarrel } from '@/gameplay/ArenaObstacles';

export function drawArenaBarrels(ctx: CanvasRenderingContext2D, barrels: readonly ArenaBarrel[],
    visible?: { x: number; y: number; width: number; height: number }): void {
    for (const { x, y, radius: r } of barrels) {
        if (visible && (x + r + 8 < visible.x || y + r + 8 < visible.y ||
            x - r > visible.x + visible.width || y - r > visible.y + visible.height)) continue;
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = '#0005';
        ctx.beginPath(); ctx.ellipse(4, 5, r + 3, r, 0, 0, Math.PI * 2); ctx.fill();
        const metal = ctx.createLinearGradient(-r, -r, r, r);
        metal.addColorStop(0, '#a58355'); metal.addColorStop(0.35, '#766044'); metal.addColorStop(1, '#3d392c');
        ctx.fillStyle = metal; ctx.strokeStyle = '#292b23'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#c0a47480'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-1, -1, r - 4, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#34362a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-r * 0.65, -r * 0.26); ctx.lineTo(r * 0.65, -r * 0.26);
        ctx.moveTo(-r * 0.65, r * 0.26); ctx.lineTo(r * 0.65, r * 0.26); ctx.stroke();
        ctx.fillStyle = '#282c24'; ctx.strokeStyle = '#ad8f60'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.45, r * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#a2562c80';
        ctx.beginPath(); ctx.arc(-r * 0.4, r * 0.4, r * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}
