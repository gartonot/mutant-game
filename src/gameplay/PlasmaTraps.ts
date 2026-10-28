import type { Player } from '../entities/player/Player';
import type { Enemy } from '../entities/enemy/Enemy';
import { getArenaSize } from './Arena';

type Point = { x: number; y: number };
type Trap = Point & { age: number; triggeredAt: number | null; detonated: boolean };
const ARM_MS = 350, LIFE_MS = 15000, WINDUP_MS = 180, FADE_MS = 400;

/** Fan placement with a deterministic inward fallback at arena corners. */
export function planPlasmaTraps(origin: Point, aim: Point, fallbackAngle = 0,
    arena = getArenaSize()): Point[] {
    const dx = aim.x - origin.x, dy = aim.y - origin.y;
    const angle = Number.isFinite(dx + dy) && Math.hypot(dx, dy) > 1 ? Math.atan2(dy, dx) : fallbackAngle;
    const clamp = (p: Point): Point => ({
        x: Math.max(35, Math.min(arena.width - 35, p.x)),
        y: Math.max(35, Math.min(arena.height - 35, p.y)),
    });
    const result: Point[] = [];
    for (const offset of [0, -.55, .55]) {
        let best = clamp({ x: origin.x + Math.cos(angle + offset) * 160, y: origin.y + Math.sin(angle + offset) * 160 });
        if (result.some(p => Math.hypot(p.x - best.x, p.y - best.y) < 58)) {
            const desired = best;
            let score = Infinity;
            for (let i = 0; i < 32; i++) {
                const a = angle + i * Math.PI / 16;
                const p = clamp({ x: origin.x + Math.cos(a) * 160, y: origin.y + Math.sin(a) * 160 });
                if (result.some(other => Math.hypot(other.x - p.x, other.y - p.y) < 58)) continue;
                const deviation = Math.hypot(p.x - desired.x, p.y - desired.y);
                if (deviation < score) { score = deviation; best = p; }
            }
        }
        result.push(best);
    }
    return result;
}

/** Stationary traps own their simulation clock; callers gate updates while paused. */
export class PlasmaTraps {
    private traps: Trap[];
    private readonly silver: boolean;
    constructor(private readonly player: Player, private readonly getEnemies: () => Enemy[], aim: Point,
        private readonly onDetonate?: (x: number, y: number) => void) {
        this.silver = player.character === 'silver-hunter';
        this.traps = planPlasmaTraps(player, aim, player.angle).map(p => ({ ...p, age: 0, triggeredAt: null, detonated: false }));
    }
    get isActive(): boolean { return this.traps.length > 0; }
    dispose(): void { this.traps = []; }
    update(deltaMs: number): void {
        if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
        if (this.player.currentHp <= 0) { this.dispose(); return; }
        for (const trap of this.traps) {
            const before = trap.age;
            trap.age += deltaMs;
            if (trap.triggeredAt === null && before < LIFE_MS && trap.age >= ARM_MS) {
                if (this.getEnemies().some(e => !e.isDead && Math.hypot(e.x - trap.x, e.y - trap.y) <= 24 + e.radius)) {
                    trap.triggeredAt = Math.max(before, ARM_MS);
                }
            }
            if (trap.triggeredAt !== null && !trap.detonated && trap.age >= trap.triggeredAt + WINDUP_MS) {
                trap.detonated = true;
                this.onDetonate?.(trap.x, trap.y);
                for (const enemy of this.getEnemies()) {
                    if (!enemy.isDead && Math.hypot(enemy.x - trap.x, enemy.y - trap.y) <= 100 + enemy.radius) {
                        enemy.receiveDamage(5, Math.atan2(enemy.y - trap.y, enemy.x - trap.x), 15);
                    }
                }
            }
        }
        this.traps = this.traps.filter(t => t.age < (t.triggeredAt === null ? LIFE_MS : t.triggeredAt + WINDUP_MS) + FADE_MS);
    }

    drawGround(ctx: CanvasRenderingContext2D): void {
        for (const trap of this.traps) {
            if (trap.detonated) continue;
            const reveal = Math.min(1, trap.age / ARM_MS);
            const charging = trap.triggeredAt === null ? 0 : Math.min(1, (trap.age - trap.triggeredAt) / WINDUP_MS);
            const fade = trap.triggeredAt === null ? Math.max(0, 1 - Math.max(0, trap.age - LIFE_MS) / FADE_MS) : 1;
            ctx.save(); ctx.translate(trap.x, trap.y);
            ctx.globalAlpha = reveal * fade;
            ctx.scale(.55 + reveal * .45, .55 + reveal * .45);
            ctx.fillStyle = '#00000066';
            ctx.beginPath(); ctx.ellipse(0, 4, 27, 21, 0, 0, Math.PI * 2); ctx.fill();
            // Three separated metal jaws open as the device arms.
            for (let i = 0; i < 3; i++) {
                ctx.save(); ctx.rotate(i * Math.PI * 2 / 3);
                ctx.fillStyle = this.silver ? '#728b9d' : '#93704b'; ctx.strokeStyle = '#202b34'; ctx.lineWidth = 2;
                const r = 12 + reveal * 5 - charging * 5;
                ctx.beginPath(); ctx.moveTo(r - 4, -9); ctx.lineTo(r + 7, -6); ctx.lineTo(r + 8, 6); ctx.lineTo(r - 4, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.strokeStyle = this.silver ? '#d8f7ff' : '#f3d097'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(r + 2, -5); ctx.lineTo(r + 3, 5); ctx.stroke();
                ctx.restore();
            }
            const pulse = .65 + Math.sin(trap.age / 210) * .16;
            ctx.globalCompositeOperation = 'lighter';
            const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 26 + charging * 10);
            glow.addColorStop(0, charging ? '#efffff' : '#65dfffaa'); glow.addColorStop(.35, '#18a9ef55'); glow.addColorStop(1, '#119be000');
            ctx.fillStyle = glow; ctx.fillRect(-36, -36, 72, 72);
            ctx.strokeStyle = '#76e7ff'; ctx.lineWidth = 1.5 + charging * 2; ctx.globalAlpha *= pulse + charging * .3;
            ctx.beginPath();
            for (let i = 0; i <= 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2; const r = 8 + charging * 5; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
            ctx.stroke();
            ctx.fillStyle = '#e0ffff'; ctx.fillRect(-2, -2, 4, 4);
            ctx.restore();
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        for (const trap of this.traps) {
            if (!trap.detonated || trap.triggeredAt === null) continue;
            const p = Math.min(1, (trap.age - trap.triggeredAt - WINDUP_MS) / FADE_MS);
            ctx.save(); ctx.translate(trap.x, trap.y); ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = (1 - p) ** 2;
            const r = 22 + Math.sqrt(p) * 85;
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            glow.addColorStop(0, '#efffff'); glow.addColorStop(.2, '#8feeffaa'); glow.addColorStop(1, '#4c91ff00');
            ctx.fillStyle = glow; ctx.fillRect(-r, -r, r * 2, r * 2);
            // Fractured plasma spokes, with brief branching arcs between shards.
            for (let i = 0; i < 12; i++) {
                const a = i * 2.39996, length = r * (.7 + (i % 3) * .12);
                ctx.save(); ctx.rotate(a);
                ctx.strokeStyle = i % 3 ? '#74ddff' : '#f0ffff'; ctx.lineWidth = (1 - p) * 2 + .5;
                ctx.beginPath(); ctx.moveTo(length * .35, 0); ctx.lineTo(length * .55, -5); ctx.lineTo(length * .68, 3); ctx.lineTo(length, 0); ctx.stroke();
                ctx.fillStyle = '#b4f8ff'; ctx.fillRect(length, -1, 4 + 7 * (1 - p), 2);
                ctx.restore();
            }
            ctx.restore();
        }
    }
}
