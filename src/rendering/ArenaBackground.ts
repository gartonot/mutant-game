import { ARENA_SLABS, ARENA_SLAB_OUTLINE, ARENA_STRIPED_BLOCK, getArenaSectors } from '@/gameplay/ArenaObstacles';

/** Static terrain, cached per viewport; solid landmark geometry is shared with collision. */
export class ArenaBackground {
    private layer?: HTMLCanvasElement;
    private tileWidth = -1;
    private tileHeight = -1;

    draw(ctx: CanvasRenderingContext2D, width: number, height: number,
        visible?: { x: number; y: number; width: number; height: number }, count = 1) {
        if (typeof document === 'undefined') return;
        const tileWidth = width / count, tileHeight = height / count;
        if (!this.layer || this.tileWidth !== tileWidth || this.tileHeight !== tileHeight) {
            this.layer = this.create(tileWidth, tileHeight);
            this.tileWidth = tileWidth; this.tileHeight = tileHeight;
        }
        // One cached sector is reused across the world. Only visible sectors are submitted.
        for (const sector of getArenaSectors(width, height, count)) {
            if (visible && (sector.x + sector.width < visible.x || sector.y + sector.height < visible.y ||
                sector.x > visible.x + visible.width || sector.y > visible.y + visible.height)) continue;
            ctx.drawImage(this.layer, sector.x, sector.y, sector.width, sector.height);
        }
    }

    private create(width: number, height: number) {
        const layer = document.createElement('canvas');
        layer.width = Math.ceil(width);
        layer.height = Math.ceil(height);
        const ctx = layer.getContext('2d')!;
        let seed = 18473;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        ctx.fillStyle = '#30352a';
        ctx.fillRect(0, 0, width, height);
        // Broad, worn concrete service road with dirt covering its edges.
        ctx.save();
        ctx.translate(width * 0.49, height * 0.5);
        // Vertical service roads connect continuously between the sector rows.
        const roadWidth = Math.min(260, width * 0.23);
        ctx.fillStyle = '#3e4035';
        ctx.fillRect(-roadWidth / 2 - 16, -height, roadWidth + 32, height * 3);
        for (let y = -height; y < height * 2; y += 140) {
            ctx.fillStyle = random() > 0.5 ? '#505047' : '#494b41';
            ctx.fillRect(-roadWidth / 2, y, roadWidth, 137);
            ctx.strokeStyle = '#292f28';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-roadWidth / 2, y + 42);
            ctx.lineTo(-roadWidth * 0.1, y + 61);
            ctx.lineTo(roadWidth * 0.04, y + 95);
            ctx.lineTo(roadWidth * 0.3, y + 102);
            ctx.stroke();
        }
        // Faded tire tracks.
        ctx.strokeStyle = '#242b2460';
        ctx.lineWidth = 8;
        for (const x of [-roadWidth * 0.3, roadWidth * 0.3]) {
            ctx.beginPath(); ctx.moveTo(x, -height); ctx.lineTo(x, height * 2); ctx.stroke();
        }
        ctx.restore();
        // Ground-only wear adds detail without introducing misleading solid props.
        for (const [px, py, radius] of [[0.22, 0.18, 43], [0.72, 0.57, 35], [0.13, 0.76, 27], [0.62, 0.91, 38]]) {
            ctx.save(); ctx.translate(width * px, height * py);
            const stain = ctx.createRadialGradient(0, 0, 3, 0, 0, radius);
            stain.addColorStop(0, '#111e1860'); stain.addColorStop(0.6, '#16271b35'); stain.addColorStop(1, '#17261b00');
            ctx.fillStyle = stain;
            ctx.beginPath(); ctx.ellipse(0, 0, radius, radius * 0.65, -0.2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        ctx.save();
        ctx.strokeStyle = '#18271d40'; ctx.lineWidth = 5;
        for (const [px, py, angle] of [[0.35, 0.66, -0.4], [0.65, 0.3, 0.5]]) {
            ctx.save(); ctx.translate(width * px, height * py); ctx.rotate(angle);
            for (const offset of [-13, 13]) {
                ctx.beginPath(); ctx.moveTo(-54, offset); ctx.bezierCurveTo(-14, offset - 7, 17, offset + 20, 63, offset + 24); ctx.stroke();
            }
            ctx.restore();
        }
        ctx.restore();
        // Small scraps lie flush with the ground and remain much smaller than obstacles.
        for (let i = 0; i < 35; i++) {
            const x = random() * width, y = random() * height;
            if (Math.abs(x / width - 0.5) < 0.2 && Math.abs(y / height - 0.5) < 0.24) continue;
            ctx.save(); ctx.translate(x, y); ctx.rotate(random() * Math.PI);
            ctx.fillStyle = i % 3 ? '#7a72503d' : '#80917b35';
            ctx.fillRect(-3, -1, 3 + random() * 6, 1 + random() * 2);
            ctx.restore();
        }
        // Fine soil grain and low, scattered vegetation use their own deterministic random source.
        for (let i = 0; i < width * height / 95; i++) {
            const x = random() * width, y = random() * height;
            ctx.fillStyle = random() > 0.5 ? '#a19b7420' : '#101e1b30';
            ctx.fillRect(x, y, 1 + random() * 3, 1 + random() * 2);
        }
        for (let i = 0; i < width * height / 2200; i++) {
            const x = random() * width, y = random() * height;
            const edge = Math.abs(x / width - 0.5) > 0.3 || Math.abs(y / height - 0.5) > 0.34;
            if (!edge) continue;
            ctx.strokeStyle = random() > 0.5 ? '#6c70523d' : '#172a2466';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let blade = 0; blade < 5; blade++) {
                ctx.moveTo(x, y);
                ctx.lineTo(x + (random() - 0.5) * 16, y - random() * 12);
            }
            ctx.stroke();
            if (random() > 0.8) {
                ctx.fillStyle = '#65665860';
                ctx.beginPath();
                ctx.moveTo(x + 9, y + 3); ctx.lineTo(x + 23, y);
                ctx.lineTo(x + 20, y + 7); ctx.lineTo(x + 11, y + 8);
                ctx.fill();
            }
        }
        // Landmark geometry is also used by the collision system.
        const scale = Math.min(1, width / 1000, height / 650);
        const landmark = (x: number, y: number, angle: number, paint: () => void) => {
            ctx.save();
            ctx.translate(width * x, height * y);
            ctx.rotate(angle);
            ctx.scale(scale, scale);
            paint();
            ctx.restore();
        };
        for (const [x, y, angle] of ARENA_SLABS) {
            landmark(x, y, angle, () => {
                ctx.fillStyle = '#56594a';
                ctx.beginPath();
                ARENA_SLAB_OUTLINE.forEach(([px, py], index) => {
                    if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                });
                ctx.closePath(); ctx.fill();
                ctx.strokeStyle = '#77796670'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(-67, 22); ctx.lineTo(-67, -38); ctx.lineTo(48, -38); ctx.stroke();
                ctx.strokeStyle = '#293228'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(-18, -43); ctx.lineTo(-6, -14);
                ctx.lineTo(-27, 7); ctx.lineTo(-12, 44); ctx.moveTo(-6, -14);
                ctx.lineTo(28, -3); ctx.lineTo(70, -14); ctx.stroke();
                // Chipped aggregate around each broken slab.
                for (let i = 0; i < 24; i++) {
                    const px = (random() - 0.5) * 190, py = (random() - 0.5) * 120;
                    if (Math.abs(px) < 73 && Math.abs(py) < 45) continue;
                    ctx.fillStyle = '#72736170';
                    ctx.fillRect(px, py, 3 + random() * 7, 2 + random() * 4);
                }
            });
        }
        for (const [x, y] of [[0.78, 0.29], [0.27, 0.63]]) {
            landmark(x, y, 0.18, () => {
                ctx.fillStyle = '#1c2722';
                ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#565044'; ctx.strokeStyle = '#77705a'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.strokeStyle = '#292e27'; ctx.lineWidth = 3;
                for (let y = -18; y <= 18; y += 9) {
                    ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(20, y); ctx.stroke();
                }
                ctx.fillStyle = '#96653d60';
                for (let i = 0; i < 18; i++) {
                    ctx.fillRect((random() - 0.5) * 40, (random() - 0.5) * 40, 3, 2);
                }
            });
        }
        landmark(...ARENA_STRIPED_BLOCK, () => {
            ctx.strokeStyle = '#aca16b60'; ctx.lineWidth = 5;
            ctx.strokeRect(-68, -42, 136, 84);
            ctx.save(); ctx.beginPath(); ctx.rect(-68, -42, 136, 84); ctx.clip();
            ctx.strokeStyle = '#a8995350'; ctx.lineWidth = 10;
            for (let x = -120; x < 140; x += 28) {
                ctx.beginPath(); ctx.moveTo(x, 42); ctx.lineTo(x + 60, -42); ctx.stroke();
            }
            ctx.restore();
        });
        // Moss patches and fallen twigs soften the outer edges of the site.
        for (const [x, y] of [[0.08, 0.47], [0.92, 0.22], [0.73, 0.87], [0.13, 0.88]]) {
            landmark(x, y, random(), () => {
                for (let i = 0; i < 55; i++) {
                    ctx.fillStyle = i % 2 ? '#64704435' : '#182d2370';
                    ctx.beginPath();
                    ctx.ellipse((random() - 0.5) * 140, (random() - 0.5) * 75, 4 + random() * 12, 2 + random() * 6, random() * 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.strokeStyle = '#77705b85'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(-35, 18); ctx.lineTo(31, -8);
                ctx.moveTo(6, 2); ctx.lineTo(13, -17); ctx.moveTo(-15, 10); ctx.lineTo(-29, -2); ctx.stroke();
            });
        }
        // Uniform shading avoids dark seams between adjacent sectors.
        ctx.fillStyle = '#08130d30';
        ctx.fillRect(0, 0, width, height);
        return layer;
    }
}
