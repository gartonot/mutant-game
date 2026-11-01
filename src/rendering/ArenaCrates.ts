import { ARENA_CRATES, ARENA_CRATE_OUTLINE, getArenaSectors, getArenaBarricades } from '@/gameplay/ArenaObstacles';

/** Top-down metal storage crates, matching the shared solid polygon layout. */
export function drawArenaCrates(ctx: CanvasRenderingContext2D, width: number, height: number, count = 1,
    visible?: { x: number; y: number; width: number; height: number }): void {
    for (const sector of getArenaSectors(width, height, count)) {
        const scale = Math.min(1, sector.width / 1000, sector.height / 650);
        for (const [px, py, angle] of ARENA_CRATES) {
            const x = sector.x + px * sector.width, y = sector.y + py * sector.height;
            const extent = 48 * scale;
            if (visible && (x + extent < visible.x || y + extent < visible.y ||
                x - extent > visible.x + visible.width || y - extent > visible.y + visible.height)) continue;
            ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
            ctx.fillStyle = '#101a1466'; ctx.fillRect(-29, -25, 65, 59);
            const metal = ctx.createLinearGradient(-32, -29, 32, 29);
            metal.addColorStop(0, '#718078'); metal.addColorStop(0.4, '#56645b'); metal.addColorStop(1, '#35483d');
            ctx.fillStyle = metal; ctx.strokeStyle = '#192b22'; ctx.lineWidth = 3;
            ctx.beginPath();
            ARENA_CRATE_OUTLINE.forEach(([cx, cy], index) => {
                if (index === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
            });
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = '#9fa99a80'; ctx.lineWidth = 2;
            ctx.strokeRect(-27, -24, 54, 48);
            ctx.strokeStyle = '#293e32'; ctx.lineWidth = 7;
            ctx.beginPath(); ctx.moveTo(-25, -22); ctx.lineTo(25, 22);
            ctx.moveTo(25, -22); ctx.lineTo(-25, 22); ctx.stroke();
            ctx.strokeStyle = '#81917e'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-25, -23); ctx.lineTo(25, 21);
            ctx.moveTo(25, -23); ctx.lineTo(-25, 21); ctx.stroke();
            ctx.fillStyle = '#b2a46b'; ctx.fillRect(-9, -7, 18, 14);
            ctx.fillStyle = '#334035'; ctx.fillRect(-5, -3, 10, 2); ctx.fillRect(-5, 1, 7, 2);
            ctx.fillStyle = '#a96e4266'; ctx.fillRect(-27, 15, 8, 6); ctx.fillRect(18, -23, 5, 8);
            ctx.restore();
        }
    }
    for (const wall of getArenaBarricades(width, height, count)) {
        const extent = Math.hypot(wall.width, wall.height) / 2 + 6;
        if (visible && (wall.x + extent < visible.x || wall.y + extent < visible.y ||
            wall.x - extent > visible.x + visible.width || wall.y - extent > visible.y + visible.height)) continue;
        ctx.save();
        // The filled silhouette comes directly from the collision polygon.
        ctx.fillStyle = '#101b15';
        ctx.beginPath();
        wall.polygon.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath(); ctx.fill();
        ctx.translate(wall.x, wall.y); ctx.rotate(wall.angle);
        const w = wall.width, h = wall.height;
        const metal = wall.material === 'cargo';
        const surface = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
        surface.addColorStop(0, metal ? '#758171' : '#969784');
        surface.addColorStop(0.22, metal ? '#53654e' : '#747a68');
        surface.addColorStop(1, metal ? '#344d38' : '#535e4c');
        ctx.fillStyle = surface;
        ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
        ctx.strokeStyle = metal ? '#a2ad8780' : '#bec1a180'; ctx.lineWidth = 2;
        ctx.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
        ctx.strokeStyle = metal ? '#243c2c' : '#3b4938'; ctx.lineWidth = 3;
        const horizontal = w >= h;
        const length = horizontal ? w : h;
        for (let offset = -length / 2 + 70; offset < length / 2 - 15; offset += 70) {
            ctx.beginPath();
            if (horizontal) { ctx.moveTo(offset, -h / 2 + 3); ctx.lineTo(offset, h / 2 - 3); }
            else { ctx.moveTo(-w / 2 + 3, offset); ctx.lineTo(w / 2 - 3, offset); }
            ctx.stroke();
        }
        // Worn yellow end markings make the solid edges legible at combat scale.
        ctx.fillStyle = '#b5a66a99';
        if (horizontal) {
            ctx.fillRect(-w / 2 + 9, -h / 2 + 8, 7, h - 16);
            ctx.fillRect(w / 2 - 16, -h / 2 + 8, 7, h - 16);
        } else {
            ctx.fillRect(-w / 2 + 8, -h / 2 + 9, w - 16, 7);
            ctx.fillRect(-w / 2 + 8, h / 2 - 16, w - 16, 7);
        }
        ctx.restore();
    }
}
